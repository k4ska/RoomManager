-- Initial schema for room-manager (PostgreSQL)

CREATE TYPE "StorageType" AS ENUM ('box','cabinet','shelf','table','drawer','locker','workbench');

CREATE TABLE "User" (
  "id" SERIAL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "Room" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "Room_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "StorageUnit" (
  "id" SERIAL PRIMARY KEY,
  "roomId" INTEGER NOT NULL,
  "type" "StorageType" NOT NULL,
  "x" INTEGER NOT NULL,
  "y" INTEGER NOT NULL,
  "w" INTEGER NOT NULL,
  "h" INTEGER NOT NULL,
  "rotation" INTEGER NOT NULL DEFAULT 0,
  "emoji" TEXT NOT NULL,
  "name" TEXT,
  CONSTRAINT "StorageUnit_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Item" (
  "id" SERIAL PRIMARY KEY,
  "unitId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "Item_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "StorageUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "QALog" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER,
  "action" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'info',
  "details" JSONB,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "QALog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Room_user_idx" ON "Room" ("userId");
CREATE INDEX "StorageUnit_room_idx" ON "StorageUnit" ("roomId");
CREATE INDEX "Item_unit_idx" ON "Item" ("unitId");
CREATE INDEX "QALog_user_idx" ON "QALog" ("userId");

