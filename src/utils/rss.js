export async function fetchRssFeed(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch RSS feed: ${res.statusText}`);
    }
    const xml = await res.text();
    
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    
    while ((match = itemRegex.exec(xml)) !== null) {
      const itemContent = match[1];
      
      const getTag = (tag) => {
        // Handle namespaced tag or standard tag
        const tagRegex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
        const tagMatch = itemContent.match(tagRegex);
        if (tagMatch) {
          let val = tagMatch[1];
          // Strip CDATA wrapper if present
          val = val.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
          return val.trim();
        }
        return '';
      };
      
      const title = getTag('title') || getTag('dc:title');
      const link = getTag('link');
      const description = getTag('description');
      const contentEncoded = getTag('content:encoded') || getTag('content');
      const pubDate = getTag('pubDate');
      
      // Extract image URL from enclosure or img tag
      let image = null;
      const enclosureMatch = itemContent.match(/<enclosure[^>]*url="([^"]+)"/);
      if (enclosureMatch) {
        image = enclosureMatch[1].replace(/&amp;/g, '&');
      } else {
        const imgMatch = (contentEncoded || description).match(/<img[^>]*src="([^"]+)"/);
        if (imgMatch) {
          image = imgMatch[1].replace(/&amp;/g, '&');
        }
      }

      // Extract all unique image URLs from content/description
      const itemImages = [];
      if (image) {
        itemImages.push(image);
      }
      const bodyHtml = contentEncoded || description || '';
      const imgRegex = /<img[^>]*src="([^"]+)"/gi;
      let imgMatch;
      while ((imgMatch = imgRegex.exec(bodyHtml)) !== null) {
        const src = imgMatch[1].replace(/&amp;/g, '&');
        if (!itemImages.includes(src)) {
          itemImages.push(src);
        }
      }
      
      items.push({
        title,
        link,
        description,
        content: contentEncoded || description,
        pubDate,
        image,
        images: itemImages,
      });
    }
    
    return items;
  } catch (err) {
    console.error(`Error fetching RSS feed from ${url}:`, err);
    return [];
  }
}
