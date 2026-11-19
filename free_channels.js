const FREE_HOLIDAY_CHANNELS = [
  {
    number: "W1",
    name: "The Christmas Station",
    genre: "Free Radio",
    desc: "Traditional classics, modern holiday hits & festive favorites (24/7 Ad-Free)",
    isDirectStream: true,
    streamUrl: "https://stream.thechristmasstation.org/main/64.aac",
    metaType: "azuracast",
    metaUrl: "https://azuracast.thechristmasstation.org/api/nowplaying/main",
    color: "#d32f2f",
    defaultArt: ""
  },
  {
    number: "W2",
    name: "Evergreen Christmas Radio",
    genre: "Free Radio",
    desc: "Upbeat holiday favorites & traditional classics (100% Non-Commercial)",
    isDirectStream: true,
    streamUrl: "https://emg.streamguys1.com/evergreen-website",
    metaType: "evergreen",
    metaUrl: "https://onair.radioapi.io/erfeasttexas/0196662a-8893-4a45-9104-c24f99123da7/onair.json",
    color: "#15803d",
    defaultArt: "https://myevergreenradio.com/wp-content/uploads/2019/11/cropped-Evergreen-Christmas-Music-Station-270x270.png"
  },
  {
    number: "W3",
    name: "Happy Christmas Radio",
    genre: "Free Radio",
    desc: "Upbeat holiday hits & modern pop-festive classics (Ad-Free)",
    isDirectStream: true,
    streamUrl: "https://radio1.streamserver.link/radio/8070/hcr-mp3",
    metaType: "azuracast",
    metaUrl: "https://radio1.streamserver.link/api/nowplaying/9",
    color: "#e11d48",
    defaultArt: ""
  },
  {
    number: "W4",
    name: "Merry Christmas Radio",
    genre: "Free Radio",
    desc: "Cozy vintage warmth, mid-century standards, crooners & instrumentals",
    isDirectStream: true,
    streamUrl: "https://radio1.streamserver.link/radio/8090/mcr-mp3",
    metaType: "azuracast",
    metaUrl: "https://radio1.streamserver.link/api/nowplaying/13",
    color: "#b45309",
    defaultArt: ""
  },
  {
    number: "W5",
    name: "SomaFM: Christmas Lounge",
    genre: "Free Radio",
    desc: "Chilled holiday grooves, downtempo & classic winter lounge tracks",
    isDirectStream: true,
    streamUrl: "https://ice2.somafm.com/christmas-128-aac",
    metaType: "somafm",
    metaUrl: "https://api.somafm.com/songs/christmas.json",
    color: "#0284c7",
    defaultArt: "https://api.somafm.com/logos/256/christmas256.png"
  },
  {
    number: "W6",
    name: "SomaFM: Dept Store Christmas",
    genre: "Free Radio",
    desc: "Nostalgic mid-century holiday elevator music & vintage instrumentals",
    isDirectStream: true,
    streamUrl: "https://ice2.somafm.com/deptstore-128-aac",
    metaType: "somafm",
    metaUrl: "https://api.somafm.com/songs/deptstore.json",
    color: "#0d9488",
    defaultArt: "https://api.somafm.com/logos/256/deptstore256.png"
  },
  {
    number: "W7",
    name: "SomaFM: Christmas Rocks!",
    genre: "Free Radio",
    desc: "Indie, alternative & rock holiday tracks (Commercial-Free)",
    isDirectStream: true,
    streamUrl: "https://ice2.somafm.com/xmasrocks-128-aac",
    metaType: "somafm",
    metaUrl: "https://api.somafm.com/songs/xmasrocks.json",
    color: "#dc2626",
    defaultArt: "https://api.somafm.com/logos/256/xmasrocks256.png"
  },
  {
    number: "W8",
    name: "SomaFM: Jolly Ol' Soul",
    genre: "Free Radio",
    desc: "Classic soul, R&B & Motown holiday grooves",
    isDirectStream: true,
    streamUrl: "https://ice2.somafm.com/jollysoul-128-aac",
    metaType: "somafm",
    metaUrl: "https://api.somafm.com/songs/jollysoul.json",
    color: "#d97706",
    defaultArt: "https://api.somafm.com/logos/256/jollysoul256.png"
  },
  {
    number: "W9",
    name: "SomaFM: Xmas in Frisko",
    genre: "Free Radio",
    desc: "Quirky, indie, comedy & off-the-wall holiday mix",
    isDirectStream: true,
    streamUrl: "https://ice2.somafm.com/xmasinfrisko-128-aac",
    metaType: "somafm",
    metaUrl: "https://api.somafm.com/songs/xmasinfrisko.json",
    color: "#7c3aed",
    defaultArt: "https://api.somafm.com/logos/256/xmasinfrisko256.jpg"
  },
  {
    number: "W10",
    name: "WQXR Holiday Channel",
    genre: "Free Radio",
    desc: "NYC Public Radio: Classical, choral & orchestral Christmas music",
    isDirectStream: true,
    streamUrl: "https://stream.wqxr.org/qxr-special",
    metaType: "wqxr",
    metaUrl: "https://api.wnyc.org/api/v1/whats_on/",
    wqxrKey: "wqxr-special2",
    color: "#1d4ed8",
    defaultArt: "https://media.wnyc.org/i/300/300/l/80/2020/11/WQXRHolidayChannel1.jpg"
  },
  {
    number: "W11",
    name: "WNYC Holiday Standards",
    genre: "Free Radio",
    desc: "NYC Public Radio: Timeless American Songbook & jazz holiday standards",
    isDirectStream: true,
    streamUrl: "https://specialstream.wnyc.org/wnyc-special",
    metaType: "wqxr",
    metaUrl: "https://api.wnyc.org/api/v1/whats_on/",
    wqxrKey: "special-events-stream",
    color: "#4338ca",
    defaultArt: ""
  }
];

module.exports = { FREE_HOLIDAY_CHANNELS };
