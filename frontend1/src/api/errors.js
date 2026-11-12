const fallbackMessage = "Сурамды аткаруу мүмкүн болгон жок.";

const normalizeApiMessage = (value) => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    if (/<!doctype\s+html|<html[\s>]/i.test(value)) {
      return "";
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeApiMessage).filter(Boolean).join(" ");
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(([field, message]) => {
        const text = normalizeApiMessage(message);
        return field === "non_field_errors" || field === "detail"
          ? text
          : `${field}: ${text}`;
      })
      .filter(Boolean)
      .join(" ");
  }

  return "";
};

export const getApiErrorMessage = (error, fallback = fallbackMessage) => {
  const responseMessage = normalizeApiMessage(error.response?.data);
  if (responseMessage) {
    return responseMessage;
  }
  return error.response ? fallback : error.message || fallback;
};
