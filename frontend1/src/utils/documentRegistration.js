export const getDocumentRegistrationCode = (document) => {
  if (document?.registrationCode) return document.registrationCode;

  const registrationNumber = document?.registrationNumber || document?.id || "__";
  const date = document?.createdAt ? new Date(document.createdAt) : new Date();
  if (Number.isNaN(date.getTime())) return String(registrationNumber);

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `"${day}"${month}"${year}-ж ${month}/${registrationNumber}`;
};
