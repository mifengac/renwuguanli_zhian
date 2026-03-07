1、新服务器信息：'dxpt', 'dxpt', "10.45.100.147:1521/yfgxpt"，版本oracle11g。
2、字段名称：id,mobile,content,deadtime,status,eid,userid,password,userport。
3、其中userport字段用于区分不同业务，分配如下：
OA:0001
指挥中心要情：0002
视频云：0003
科信业务管理平台：0004
侦查中心实时警情监测：0005
--待添加
4、示例sql：
insert into yfgadb.dfsdl (id,mobile,content,deadtime,status,eid,userid,password,userport) 
values (yfgadb.seq_sendsms.nextval,'18807661151','222222342342',sysdate,'0','22371000235','admin','yfga8130018','0004')

5、表结构
-- Create table
create table DFSDL
(
  ID       NUMBER not null,
  MOBILE   VARCHAR2(1000),
  CONTENT  VARCHAR2(4000),
  DEADTIME DATE,
  STATUS   NUMBER,
  EID      VARCHAR2(50),
  USERID   VARCHAR2(50),
  PASSWORD VARCHAR2(50),
  USERPORT VARCHAR2(4)
)
tablespace TBS_BZK
  pctfree 10
  initrans 1
  maxtrans 255
  storage
  (
    initial 16
    next 8
    minextents 1
    maxextents unlimited
  );
-- Add comments to the table 
comment on table DFSDL
  is 'OA短信表';
-- Add comments to the columns 
comment on column DFSDL.ID
  is '短信标识';
comment on column DFSDL.MOBILE
  is '目标手机号码';
comment on column DFSDL.CONTENT
  is '短信内容';
comment on column DFSDL.DEADTIME
  is '有效时间';
comment on column DFSDL.STATUS
  is '信息状态';
comment on column DFSDL.EID
  is '上行信息所属企业编号';
comment on column DFSDL.USERID
  is '发送信息的用户ID号';
comment on column DFSDL.PASSWORD
  is '发送信息的用户密码';
comment on column DFSDL.USERPORT
  is '扩展号';
-- Create/Recreate primary, unique and foreign key constraints 
alter table DFSDL
  add constraint DFSDL_ID primary key (ID)
  using index 
  tablespace TBS_BZK
  pctfree 10
  initrans 2
  maxtrans 255
  storage
  (
    initial 64K
    next 1M
    minextents 1
    maxextents unlimited
  );
-- Grant/Revoke object privileges 
grant select, insert on DFSDL to DXPT;
grant select, insert, update, delete on DFSDL to HLWBJ;
