-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'MEDICAL', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);
