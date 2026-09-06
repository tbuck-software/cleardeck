export interface StaffImportRow {
  rowNumber: number;
  name: string;
  qualification: string;
  startDate: string;
  endDate: string;
  weeklyHours: string;
  fte: string;
  birthDate: string;
  employeeId?: number;
  sourceRef: string;
  selected: boolean;
  issues: string[];
}
export interface StaffImportPreview {
  source: string;
  rows: StaffImportRow[];
}
