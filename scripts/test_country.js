const https = require('https');
const countries = ['in', 'gb', 'au', 'ca', 'us', 'de'];
countries.forEach(country => {
  const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=1/id=324684580/sortby=mostRecent/json`;
  https.get(url, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try {
        const j = JSON.parse(d);
        const n = j.feed && j.feed.entry ? j.feed.entry.length : 0;
        console.log(country.toUpperCase() + ':', n, 'reviews');
      } catch (e) { console.log(country + ': parse err'); }
    });
  }).on('error', e => console.error(country + ':', e.message));
});
