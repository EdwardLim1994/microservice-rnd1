-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "grossSalary" DOUBLE PRECISION NOT NULL,
    "supervisorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeId_key" ON "Employee"("employeeId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
