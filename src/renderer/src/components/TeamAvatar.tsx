import lina from '../assets/team/lina.jpg'
import noah from '../assets/team/noah.jpg'
import ayoub from '../assets/team/ayoub.jpg'
import mohammed from '../assets/team/mohammed.jpg'
import sara from '../assets/team/sara.jpg'
import alex from '../assets/team/alex.jpg'
import emma from '../assets/team/emma.jpg'
import yassine from '../assets/team/yassine.jpg'
const photos:Record<string,string>={lina,noah,ayoub,mohammed,sara,alex,emma,yassine,you:mohammed}
export function TeamAvatar({name}:{name:string}){const photo=photos[name.toLowerCase().split(' ')[0]];return photo?<img className="team-avatar" src={photo} alt={name}/>:<span className="team-avatar" aria-label={name}>{name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span>}
