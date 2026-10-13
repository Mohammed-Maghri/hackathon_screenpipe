CREATE TABLE "RecordingSecret" (
    "id" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "RecordingSecret_pkey" PRIMARY KEY ("id")
);
