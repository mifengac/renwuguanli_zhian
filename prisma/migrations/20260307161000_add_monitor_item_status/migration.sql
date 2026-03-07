CREATE TYPE "MonitorItemStatus" AS ENUM ('ACTIVE', 'COMPLETED');

ALTER TABLE "monitor_item"
  ADD COLUMN "status" "MonitorItemStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "monitor_item_status_idx"
  ON "monitor_item"("status");
