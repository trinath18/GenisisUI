SET NOCOUNT ON;
DELETE dbo.CASAuditReview WHERE CASNumber = 'XI00002733';
PRINT 'audit rows removed: ' + CAST(@@ROWCOUNT AS varchar);
UPDATE genisis.Maint_CASCrossReference SET CASARStatus = NULL WHERE CASNumber = 'XI00002733';
UPDATE genisis.Maint_CASCrossReference SET TransRemarks = NULL, MBMNumber = 'ZZHA0000518*01', MBMPatientCovID = '00' WHERE CASNumber = 'ZZ00000106';
UPDATE dbo.CAS SET CASLastUpdateUser = NULL, CASLastUpdateDate = NULL, MBMNumber = 'ZZHA0000518*01', MBMPatientCovID = '00' WHERE CASNumber = 'ZZ00000106';
DELETE dbo.CASPayClaim WHERE CASNumber = 'ZZ00000106' AND CASRegUser LIKE 'E2E%';
UPDATE dbo.CASOthersTwo SET CASPreIllCAT=NULL, CASPreIllDate=NULL, CASPreIllOthers=NULL, CASPreIllInfBy=NULL, CASUndIllCAT=NULL, CASUndIllDate=NULL, CASUndIllOthers=NULL, CASUndIllInfBy=NULL WHERE CASNumber='ZZ00000106';
UPDATE genisis.WS_Claim SET CLMBordxWSASCII = 'N' WHERE CLMBordxWSASCII = 'Y' AND CASNumber IN (SELECT CASNumber FROM genisis.WS_CLMReport WHERE PAYCode = 'GC');
UPDATE dbo.CASOthersTwo SET CASASCIIGenStatus = NULL WHERE CASASCIIGenStatus = 'Y';
DELETE genisis.WS_CLMAsciiSEQ WHERE SEQBatchDate = CAST(GETDATE() AS date) AND SEQPayCode IN ('GC', 'AN');
DELETE dbo.CASAsciiSEQ WHERE SEQBatchDate = CAST(GETDATE() AS date) AND SEQPayCode IN ('BI');
SELECT 'zz case' AS what, c.MBMNumber, c.MBMPatientCovID, x.MBMNumber AS xrefMbm, x.TransRemarks, c.CASLastUpdateUser FROM dbo.CAS c JOIN genisis.Maint_CASCrossReference x ON x.CASNumber = c.CASNumber WHERE c.CASNumber = 'ZZ00000106';
SELECT 'zz limits' AS what, RTRIM(MBMNumber) AS m, MBMAvailableLimit FROM dbo.MBM WHERE MBMNumber IN ('ZZHA0000316*01', 'ZZHA0000518*01') ORDER BY MBMNumber;
SELECT 'flags' AS what, (SELECT COUNT(*) FROM genisis.WS_Claim WHERE CLMBordxWSASCII = 'Y') AS claimsY, (SELECT COUNT(*) FROM dbo.CASOthersTwo WHERE CASASCIIGenStatus = 'Y') AS casesY, (SELECT COUNT(*) FROM dbo.CASAuditReview WHERE CASNumber = 'XI00002733') AS auditRows;

-- invoice-entry.mjs adds one invoice (number E2E-...) to a real case and removes it itself; this removes any a failed run left, with all of its rows
DECLARE @invoice int;
DECLARE e2e_invoices CURSOR FOR SELECT INVIndex FROM genisis.WS_ClaimInvoice WHERE InvNo LIKE 'E2E-%';
OPEN e2e_invoices;
FETCH NEXT FROM e2e_invoices INTO @invoice;
WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC genisis.Invoice_Remove @invoice;
    FETCH NEXT FROM e2e_invoices INTO @invoice;
END
CLOSE e2e_invoices;
DEALLOCATE e2e_invoices;
SELECT 'e2e invoices left' AS what, COUNT(*) AS n FROM genisis.WS_ClaimInvoice WHERE InvNo LIKE 'E2E-%';

-- case-registration.mjs registers a case for the ZZ test member as user E2E. This removes every row such a case wrote (the nine case tables of the main
-- database and the case cross-reference of the maintenance one, the same ten tables the save writes) and puts the ZZ case counter back to the highest
-- ZZ case that is left. Only cases opened by E2E on the ZZ test payor are touched.
DECLARE @e2eCases TABLE (CASNumber nvarchar(15) PRIMARY KEY);
INSERT @e2eCases SELECT CASNumber FROM dbo.CAS WHERE CaseOpenBy = 'E2E' AND CASNumber LIKE 'ZZ%';
DELETE dbo.CASOthersTwo WHERE CASNumber IN (SELECT CASNumber FROM @e2eCases);
DELETE dbo.CASOthers WHERE CASNumber IN (SELECT CASNumber FROM @e2eCases);
DELETE dbo.CAS_UD WHERE CASNumber IN (SELECT CASNumber FROM @e2eCases);
DELETE dbo.CASRemarkThree WHERE CASNumber IN (SELECT CASNumber FROM @e2eCases);
DELETE dbo.CASRemarksTwo WHERE CASNumber IN (SELECT CASNumber FROM @e2eCases);
DELETE dbo.CASRemarks WHERE CASNumber IN (SELECT CASNumber FROM @e2eCases);
DELETE dbo.DIAFinal WHERE CASNumber IN (SELECT CASNumber FROM @e2eCases);
DELETE dbo.DIAFirst WHERE CASNumber IN (SELECT CASNumber FROM @e2eCases);
DELETE genisis.Maint_CASCrossReference WHERE CASNumber IN (SELECT CASNumber FROM @e2eCases);
DELETE dbo.CAS WHERE CASNumber IN (SELECT CASNumber FROM @e2eCases);
DECLARE @removedCases int = (SELECT COUNT(*) FROM @e2eCases);
PRINT 'e2e registered cases removed: ' + CAST(@removedCases AS varchar);
UPDATE genisis.Maint_CAQ2013 SET CAQNumber = RIGHT('00000000' + CAST(ISNULL((SELECT MAX(CAST(SUBSTRING(RTRIM(CASNumber), 3, 8) AS bigint)) FROM dbo.CAS WHERE CASNumber LIKE 'ZZ%'), 0) AS varchar(8)), 8) WHERE PAYCode = 'ZZ';
SELECT 'zz cases / counter' AS what, (SELECT COUNT(*) FROM dbo.CAS WHERE CASNumber LIKE 'ZZ%') AS zzCases, (SELECT MAX(RTRIM(CASNumber)) FROM dbo.CAS WHERE CASNumber LIKE 'ZZ%') AS lastZzCase, (SELECT RTRIM(CAQNumber) FROM genisis.Maint_CAQ2013 WHERE PAYCode = 'ZZ') AS counter, (SELECT COUNT(*) FROM dbo.CAS WHERE CaseOpenBy = 'E2E') AS e2eCasesLeft;
