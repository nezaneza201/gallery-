export const dynamic='force-dynamic';

export default async function ExhibitPage({params}){
 const {id}=await params;
 return <main className="exhibitPage"><a className="backLink" href="/">← Back to the Museum</a><section className="exhibitIntro"><p className="eyebrow">CREATIVE MUSEUM · EXHIBIT</p><h1>Exhibit {id}</h1><p>Open the museum collection to explore this work and its story.</p><a href="/#work" className="museumButton">Explore the collection ↗</a></section></main>
}

export async function generateMetadata({params}){const {id}=await params;return {title:`Exhibit ${id} — The Creative Museum`,description:'An exhibit from The Creative Museum — photography, editing and design.'}}
