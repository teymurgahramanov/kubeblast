import jsPDF from "jspdf";
import "jspdf-autotable";
import { format } from "date-fns";

const generatePDF = (jobs) => {
  const doc = new jsPDF();
  const tableColumn = ["ID", "Job Name", "Owner", "Description", "Closed on"];
  const tableRows = [];

  jobs.forEach((job) => {
    const jobData = [
      job.id,
      job.name,
      job.owner,
      job.description,
      format(new Date(job.updated_at), "yyyy-MM-dd"),
    ];
    tableRows.push(jobData);
  });

  // Use the new autoTable API
  doc.autoTable({
    
    head: [tableColumn],
    body: tableRows,
    startY: 20,
  });

  // Create a date string for the file name
  const date = new Date();
  const dateStr = date.toISOString().replace(/[:\-T]/g, "").split(".")[0];

  doc.text("Closed jobs within the last one month.", 14, 15);
  doc.save(`report_${dateStr}.pdf`);
};

export default generatePDF;
