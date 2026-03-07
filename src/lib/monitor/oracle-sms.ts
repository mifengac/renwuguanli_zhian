import { existsSync } from "node:fs";

export type OracleSmsPayload = {
  oracleEid: string;
  mobile: string;
  content: string;
  pushTime: Date;
};

export type OracleSmsSendResult = {
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  failReason?: string;
  oraclePushTime?: Date;
};

type OracleExecuteResult = {
  rows?: Array<Record<string, unknown>>;
};

type OracleConnection = {
  execute: (
    sql: string,
    bindParams: Record<string, unknown>,
    options?: Record<string, unknown>
  ) => Promise<OracleExecuteResult>;
  close: () => Promise<void>;
};

type OracleDbModule = {
  initOracleClient?: (options: { libDir: string }) => void;
  getConnection: (options: Record<string, unknown>) => Promise<OracleConnection>;
};

const DEFAULT_ORACLE_CLIENT_LIB_DIR = "/opt/oracle/instantclient";
const DEFAULT_ORACLE_SMS_TABLE = "YFGADB.DFSDL";
const DEFAULT_ORACLE_SMS_SEQUENCE = "YFGADB.SEQ_SENDSMS";
const DEFAULT_ORACLE_SMS_USERPORT = "0006";

let oracleClientInitialized = false;
let initializedOracleClientLibDir: string | null = null;

async function loadOracleDbModule(): Promise<OracleDbModule> {
  const importer = new Function(
    "modulePath",
    "return import(modulePath);"
  ) as (modulePath: string) => Promise<unknown>;

  const mod = (await importer("oracledb")) as Record<string, unknown>;
  return (mod.default ?? mod) as OracleDbModule;
}

function getOracleSmsTableName(): string {
  return process.env.ORACLE_SMS_TABLE?.trim() || DEFAULT_ORACLE_SMS_TABLE;
}

function getOracleInsertSql(): string {
  const customSql = process.env.ORACLE_SMS_INSERT_SQL?.trim();
  if (customSql) return customSql;

  const sequenceName =
    process.env.ORACLE_SMS_SEQUENCE?.trim() || DEFAULT_ORACLE_SMS_SEQUENCE;

  return `INSERT INTO ${getOracleSmsTableName()} (ID, MOBILE, CONTENT, DEADTIME, STATUS, EID, USERID, PASSWORD, USERPORT) VALUES (${sequenceName}.NEXTVAL, :mobile, :content, :deadtime, :status, :eid, :userid, :password, :userport)`;
}

function getOracleExistsSql(): string {
  const customSql = process.env.ORACLE_SMS_EXISTS_SQL?.trim();
  if (customSql) return customSql;

  return `SELECT 1 AS FOUND FROM ${getOracleSmsTableName()} WHERE EID = :eid AND MOBILE = :mobile AND ROWNUM = 1`;
}

function getOracleClientLibDir() {
  return (
    process.env.ORACLE_CLIENT_LIB_DIR?.trim() || DEFAULT_ORACLE_CLIENT_LIB_DIR
  );
}

function getOracleQueueUserId(): string {
  return process.env.ORACLE_SMS_QUEUE_USERID?.trim() || "";
}

function getOracleQueuePassword(): string {
  return process.env.ORACLE_SMS_QUEUE_PASSWORD?.trim() || "";
}

function getOracleSmsUserPort(): string {
  return process.env.ORACLE_SMS_USERPORT?.trim() || DEFAULT_ORACLE_SMS_USERPORT;
}

function ensureOracleThickMode(oracledb: OracleDbModule) {
  const libDir = getOracleClientLibDir();

  if (oracleClientInitialized) {
    if (initializedOracleClientLibDir !== libDir) {
      throw new Error(
        `Oracle Instant Client already initialized with ${initializedOracleClientLibDir}, current ORACLE_CLIENT_LIB_DIR=${libDir}`
      );
    }
    return;
  }

  if (!existsSync(libDir)) {
    throw new Error(
      `Oracle Instant Client not found at ${libDir}. Check ORACLE_CLIENT_LIB_DIR.`
    );
  }

  if (!oracledb.initOracleClient) {
    throw new Error("Current oracledb runtime does not support thick mode.");
  }

  oracledb.initOracleClient({ libDir });
  oracleClientInitialized = true;
  initializedOracleClientLibDir = libDir;
}

async function hasOracleSmsRecord(
  connection: OracleConnection,
  payload: Pick<OracleSmsPayload, "oracleEid" | "mobile">
) {
  const result = await connection.execute(getOracleExistsSql(), {
    eid: payload.oracleEid,
    mobile: payload.mobile,
  });

  return (result.rows?.length ?? 0) > 0;
}

export async function sendSmsByOracleQueue(
  payload: OracleSmsPayload
): Promise<OracleSmsSendResult> {
  const driver = (process.env.MONITOR_SMS_DRIVER || "mock").trim().toLowerCase();

  if (!payload.mobile.trim()) {
    return {
      status: "SKIPPED",
      failReason: "mobile is empty",
    };
  }

  if (driver === "disabled") {
    return {
      status: "SKIPPED",
      failReason: "MONITOR_SMS_DRIVER=disabled",
    };
  }

  if (driver !== "oracle") {
    return {
      status: "SUCCESS",
      oraclePushTime: new Date(),
    };
  }

  const user = process.env.ORACLE_SMS_USER?.trim();
  const password = process.env.ORACLE_SMS_PASSWORD?.trim();
  const connectString = process.env.ORACLE_SMS_CONNECT_STRING?.trim();
  const queueUserId = getOracleQueueUserId();
  const queuePassword = getOracleQueuePassword();
  const userPort = getOracleSmsUserPort();

  if (!user || !password || !connectString) {
    return {
      status: "FAILED",
      failReason:
        "Missing ORACLE_SMS_USER, ORACLE_SMS_PASSWORD, or ORACLE_SMS_CONNECT_STRING",
    };
  }

  if (!queueUserId || !queuePassword) {
    return {
      status: "FAILED",
      failReason:
        "Missing ORACLE_SMS_QUEUE_USERID or ORACLE_SMS_QUEUE_PASSWORD",
    };
  }

  let connection: OracleConnection | null = null;

  try {
    const oracledb = await loadOracleDbModule();
    ensureOracleThickMode(oracledb);

    connection = await oracledb.getConnection({
      user,
      password,
      connectString,
    });

    const alreadyQueued = await hasOracleSmsRecord(connection, payload);
    if (alreadyQueued) {
      return {
        status: "SKIPPED",
        failReason: "Oracle already has the same eid + mobile record",
      };
    }

    await connection.execute(
      getOracleInsertSql(),
      {
        mobile: payload.mobile,
        content: payload.content,
        deadtime: payload.pushTime,
        status: 0,
        eid: payload.oracleEid,
        userid: queueUserId,
        password: queuePassword,
        userport: userPort,
      },
      {
        autoCommit: true,
      }
    );

    return {
      status: "SUCCESS",
      oraclePushTime: new Date(),
    };
  } catch (error) {
    return {
      status: "FAILED",
      failReason:
        error instanceof Error ? error.message : "Oracle SMS enqueue failed",
    };
  } finally {
    if (connection) {
      await connection.close().catch(() => undefined);
    }
  }
}
