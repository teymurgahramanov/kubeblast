import { jsPDF } from "jspdf";

const generatePDF = (job) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF();
      
      // Add title and job details to the PDF
      doc.setFontSize(18);
      doc.text("Job Report", 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Job Name: ${job.job_name}`, 20, 30);
      doc.text(`Owner: ${job.owner}`, 20, 40);
      doc.text(`Description: ${job.description}`, 20, 50);
      doc.text(`Status: ${job.status}`, 20, 60);
      
      // Save the PDF as a Blob
      const pdfBlob = doc.output("blob");
      resolve(pdfBlob);
    } catch (error) {
      reject(error);
    }
  });
};
export default generatePDF