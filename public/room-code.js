// Accept lowercase codes and visually identical Ukrainian letters when pasted.
export function normalizeRoomCode(value){
  const similar={'А':'A','В':'B','С':'C','Е':'E','Н':'H','К':'K','М':'M','О':'O','Р':'P','Т':'T','Х':'X','І':'I'};
  return String(value||'').trim().toUpperCase().replace(/[АВСЕНКМОРТХІ]/g,c=>similar[c]);
}
export function validRoomCode(value){return /^[A-Z0-9]{4}$/.test(normalizeRoomCode(value));}
