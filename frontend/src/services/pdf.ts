import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Child, Report } from '@/lib/store';

export const pdfService = {
  generateProgressReport(child: Child, reports: Report[]) {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.text('AuticareAI - Progress Report', 14, 22);
    
    // Child Info
    doc.setFontSize(12);
    doc.text(`Child Name: ${child.name}`, 14, 32);
    doc.text(`Date of Birth: ${child.dateOfBirth}`, 14, 38);
    doc.text(`Status: ${child.screeningStatus}`, 14, 44);

    // Reports Table
    const tableData = reports.map(report => [
      new Date(report.createdAt).toLocaleDateString(),
      report.type,
      report.doctorNotes || 'N/A',
      report.diagnosisConfirmation || 'N/A'
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['Date', 'Type', 'Notes', 'Diagnosis']],
      body: tableData,
    });

    doc.save(`${child.name.replace(/\s+/g, '_')}_progress_report.pdf`);
  }
};
