import { WorksheetEnquiryPage } from './WorksheetEnquiryPage'

/**
 * Worksheet > Worksheet Adjustment (legacy frmWorksheetAdj2013): the worksheet as the Enquiry shows it, with the Update button that saves the payment details and remarks
 * of the version on show. Approve, credit / debit notes and the letters are not migrated yet.
 */
export function WorksheetAdjustmentPage() {
  return <WorksheetEnquiryPage adjust />
}
