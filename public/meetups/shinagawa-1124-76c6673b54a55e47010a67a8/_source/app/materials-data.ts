export type SlideDeck = { id: string; label: string; file: string; slides: { id: string; title: string }[] };
export type DeckKey = "slides" | "worksheets";
export type Materials = Record<DeckKey, SlideDeck>;

export function isMaterials(input: unknown): input is Materials {
  if(!input || typeof input!=="object")return false;
  return (["slides","worksheets"] as const).every((kind,index)=>{
    const deck=(input as Partial<Materials>)[kind];
    if(!deck || !/^[A-Za-z0-9_-]{10,128}$/u.test(deck.id) || typeof deck.label!=="string"
      || deck.file!==(index===0?"event":"worksheet") || !Array.isArray(deck.slides) || deck.slides.length===0 || deck.slides.length>90) return false;
    return deck.slides.every(slide=>typeof slide?.id==="string"&&/^[A-Za-z0-9_-]+$/u.test(slide.id)&&typeof slide.title==="string");
  });
}
