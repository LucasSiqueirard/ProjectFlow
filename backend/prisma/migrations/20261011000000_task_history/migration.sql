CREATE TABLE "TaskHistory" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskHistory_taskId_changedAt_idx" ON "TaskHistory"("taskId", "changedAt");

ALTER TABLE "TaskHistory"
ADD CONSTRAINT "TaskHistory_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
