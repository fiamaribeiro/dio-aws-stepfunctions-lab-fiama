// Valida a entrada. Retorna { isValid, requestId }.
// A ASL usa $.validation.Payload.isValid no Choice.

exports.handler = async (event) => {
  // Aceita { requestId: "REQ-123", ... }
  const requestId = event?.requestId;

  const isValid =
    typeof requestId === "string" &&
    requestId.trim().length > 0 &&
    requestId.length <= 64;

  return {
    isValid,
    requestId: isValid ? requestId : null,
  };
};
