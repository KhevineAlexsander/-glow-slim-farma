/**
 * Imagens de acervos abertos usadas na página inicial (baixadas com a TasteSkill).
 * São imagens do universo da farmácia, nunca apresentadas como produtos da loja.
 * Detalhes completos em public/images/acervo/credits.json.
 */
export const ACERVO = {
  frascosAzuis: {
    src: '/images/acervo/pharmacy-bottles-blue-hg.webp',
    width: 1394,
    height: 1400,
    alt: 'Dois frascos de farmácia antigos de vidro azul, com rótulos brancos (início do século XX)',
  },
  vitrine1910: {
    src: '/images/acervo/elephanten-apotheke-leipziger-str-74-berlin-schaufensterwett.webp',
    width: 1400,
    height: 957,
    alt: 'Vitrine de uma farmácia em Berlim, 1910, com potes e frascos de vidro',
  },
  vidraria1895: {
    src: '/images/acervo/graduated-chemical-glassware-alessandri-1895-1.webp',
    width: 1400,
    height: 1326,
    alt: 'Gravura de 1895 com béqueres e frascos graduados de laboratório',
  },
  solucoes: {
    src: '/images/acervo/equipment-and-glassware.webp',
    width: 1400,
    height: 825,
    alt: 'Tubos de ensaio e béqueres com soluções coloridas em um laboratório',
  },
} as const

export const IMAGE_CREDITS = [
  {
    title: 'Pharmacy bottles blue',
    creator: 'Hannes Grobe',
    license: 'CC BY-SA 4.0',
    url: 'https://commons.wikimedia.org/wiki/File:Pharmacy-bottles-blue_hg.jpg',
  },
  {
    title: 'Elephanten-Apotheke, Berlim, 1910',
    creator: 'Zander & Labisch',
    license: 'domínio público',
    url: 'https://commons.wikimedia.org/wiki/File:Elephanten-Apotheke,_Leipziger_Str._74_(Berlin),_Schaufensterwettbewerb_1910_(cropped).png',
  },
  {
    title: 'Graduated chemical glassware (Alessandri, 1895)',
    creator: 'valeg96',
    license: 'domínio público',
    url: 'https://commons.wikimedia.org/wiki/File:Graduated_chemical_glassware_(Alessandri_1895.1).png',
  },
  {
    title: 'Equipment and glassware',
    creator: 'Belikov Maxim',
    license: 'CC BY 4.0',
    url: 'https://commons.wikimedia.org/wiki/File:Equipment_and_glassware.jpg',
  },
] as const
