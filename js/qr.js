export function renderQr(element, text) {
  element.innerHTML = '';

  if (!window.QRCode) {
    element.textContent = text;
    return;
  }

  new window.QRCode(element, {
    text,
    width: 184,
    height: 184,
    correctLevel: window.QRCode.CorrectLevel.M,
  });
}
