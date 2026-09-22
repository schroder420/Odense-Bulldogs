import type {Metadata} from 'next';
import './globals.css';
import './screen-layout.css';
export const metadata:Metadata={title:'Hold pucken i live · Odense Bulldogs',description:'Bulldogs pausespil. Find en medspiller, undgå modstanderne og hold pucken i live.',robots:{index:false,follow:false},icons:{icon:'/assets/bulldogs-logo.png'},appleWebApp:{capable:true,title:'Bulldogs Pausespil',statusBarStyle:'black-translucent'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="da"><body>{children}</body></html>;}
