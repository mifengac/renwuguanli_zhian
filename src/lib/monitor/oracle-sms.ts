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

type OracleConnection = {
  execute: (
    sql: string,
    bindParams: Record<string, unknown>,
    options?: Record<string, unknown>
  ) => Promise<unknown>;
  close: () => Promise<void>;
};

type OracleDbModule = {
  initOracleClient?: (options: { libDir: string }) => void;
  getConnection: (options: Record<string, unknown>) => Promise<OracleConnection>;
};

const DEFAULT_ORACLE_CLIENT_LIB_DIR = "/opt/oracle/instantclient";

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

function getOracleInsertSql(): string {
  const customSql = process.env.ORACLE_SMS_INSERT_SQL?.trim();
  if (customSql) return customSql;

  const tableName = process.env.ORACLE_SMS_TABLE?.trim() || "SMS_QUEUE";
  return `INSERT INTO ${tableName} (EID, MOBILE, CONTENT, PUSH_TIME, CREATED_AT) VALUES (:eid, :mobile, :content, :pushTime, :createdAt)`;
}

function getOracleClientLibDir() {
  return (
    process.env.ORACLE_CLIENT_LIB_DIR?.trim() || DEFAULT_ORACLE_CLIENT_LIB_DIR
  );
}

function ensureOracleThickMode(oracledb: OracleDbModule) {
  const libDir = getOracleClientLibDir();

  if (oracleClientInitialized) {
    if (initializedOracleClientLibDir !== libDir) {
      throw new Error(
        `Oracle Instant Client 已按 ${initializedOracleClientLibDir} 初始化，当前 ORACLE_CLIENT_LIB_DIR=${libDir} 不一致`
      );
    }
    return;
  }

  if (!existsSync(libDir)) {
    throw new Error(
      `未找到 Oracle Instant Client 目录：${libDir}。请确认镜像内已包含 Instant Client，并设置 ORACLE_CLIENT_LIB_DIR`
    );
  }

  if (!oracledb.initOracleClient) {
    throw new Error("当前 oracledb 运行时不支持 thick mode 初始化");
  }

  oracledb.initOracleClient({ libDir });
  oracleClientInitialized = true;
  initializedOracleClientLibDir = libDir;
}

export async function sendSmsByOracleQueue(
  payload: OracleSmsPayload
): Promise<OracleSmsSendResult> {
  const driver = (process.env.MONITOR_SMS_DRIVER || "mock").trim().toLowerCase();

  if (!payload.mobile.trim()) {
    return {
      status: "SKIPPED",
      failReason: "未配置手机号，已跳过短信发送",
    };
  }

  if (driver === "disabled") {
    return {
      status: "SKIPPED",
      failReason: "MONITOR_SMS_DRIVER=disabled，已跳过短信发送",
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

  if (!user || !password || !connectString) {
    return {
      status: "FAILED",
      failReason: "Oracle 短信配置不完整，请检查 ORACLE_SMS_USER/ORACLE_SMS_PASSWORD/ORACLE_SMS_CONNECT_STRING",
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

    await connection.execute(
      getOracleInsertSql(),
      {
        eid: payload.oracleEid,
        mobile: payload.mobile,
        content: payload.content,
        pushTime: payload.pushTime,
        createdAt: new Date(),
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
      failReason: error instanceof Error ? error.message : "Oracle 短信发送失败",
    };
  } finally {
    if (connection) {
      await connection.close().catch(() => undefined);
    }
  }
}
