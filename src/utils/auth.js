export function roleToPath(role){
  switch(role){
    case "Admin": return "/admin";
    case "Planning": return "/planning";
    case "AnimalHusbandry": return "/ah/home";
    case "Catching": return "/catching";
    case "Driver": return "/driver/home";
    case "Factory": return "/factory/home";
    case "Manager": return "/manager/home";
    default: return "/login";
  }
}
export function saveSession(user){
  const expiresAt = Date.now() + 60*60*1000; // 1h
  localStorage.setItem("user", JSON.stringify({...user, expiresAt}));
}
export function getSession(){
  try{
    const s = localStorage.getItem("user");
    if(!s) return null;
    const u = JSON.parse(s);
    if(!u.expiresAt || u.expiresAt < Date.now()){ clearSession(); return null; }
    return u;
  }catch{ return null; }
}
export function clearSession(){ localStorage.removeItem("user"); }
