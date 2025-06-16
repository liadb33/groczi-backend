import { PrismaClient } from "@prisma/client";
import { JSDOM } from "jsdom";

const prisma = new PrismaClient();

interface ScrapedImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

/**
 * Scrape Hebrew Wikipedia page and extract the logo image from infobox
 */
async function getSubChainImageFromHebrewWikipedia(subchainname: string): Promise<string | null> {
  try {
    // Construct the Wikipedia URL
    const encodedName = encodeURIComponent(subchainname);
    const wikipediaUrl = `https://he.wikipedia.org/wiki/${encodedName}`;
    
    console.log(`🔍 Scraping Wikipedia page: ${wikipediaUrl}`);
    
    // Fetch the HTML page
    const response = await fetch(wikipediaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      console.log(`❌ Failed to fetch Wikipedia page: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const html = await response.text();
    console.log(`📄 Successfully fetched HTML (${html.length} characters)`);
    
    // Parse HTML with JSDOM
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Try multiple selectors to find the logo image in the infobox
    const imageSelectors = [
      // Main infobox image (your provided selector)
      '#mw-content-text > div.mw-content-rtl.mw-parser-output > table.infobox > tbody > tr:nth-child(1) > td > span > a > img',
      // Alternative infobox selectors
      'table.infobox img',
      '.infobox img',
      // More general selectors for infobox
      'table.infobox tr:first-child img',
      'table.infobox td img',
      // Fallback to any image in the main content area
      '#mw-content-text img'
    ];
    
    for (const selector of imageSelectors) {
      console.log(`🔍 Trying selector: ${selector}`);
      
      const imgElement = document.querySelector(selector);
      if (imgElement) {
        const src = imgElement.getAttribute('src');
        const alt = imgElement.getAttribute('alt') || '';
        
        if (src) {
          // Convert relative URLs to absolute URLs
          let imageUrl = src;
          if (src.startsWith('//')) {
            imageUrl = `https:${src}`;
          } else if (src.startsWith('/')) {
            imageUrl = `https://he.wikipedia.org${src}`;
          }
          
          // Skip very small images (likely icons)
          const width = parseInt(imgElement.getAttribute('width') || '0');
          const height = parseInt(imgElement.getAttribute('height') || '0');
          
          // Log image details
          console.log(`📸 Found image with selector "${selector}"`);
          console.log(`   🖼️  URL: ${imageUrl}`);
          console.log(`   📝 Alt: ${alt}`);
          console.log(`   📏 Size: ${width}x${height}`);
          
          // Skip very small images (likely icons) but allow if no size specified
          if ((width > 0 && height > 0) && (width < 50 || height < 50)) {
            console.log(`   ⚠️  Skipping small image (${width}x${height})`);
            continue;
          }
          
          // Skip common non-logo images
          const skipPatterns = [
            'commons-logo',
            'wikimedia',
            'edit-icon',
            'ambox',
            'crystal',
            'magnify-clip'
          ];
          
          console.log(`✔️ Selected image: ${imageUrl}`);
          return imageUrl;
        }
      }
    }
    
    console.log(`❌ No suitable images found on Wikipedia page for: ${subchainname}`);
    return null;
    
  } catch (error) {
    console.error(`💥 Error scraping Wikipedia for ${subchainname}:`, error);
    return null;
  }
}

/**
 * Main function to process all subchains without images
 */
async function main() {
  console.log("🚀 Starting Hebrew Wikipedia image scraping for subchains...");
  
  const subchains = await prisma.subchains.findMany({
    where: { imageUrl: null },
    select: { 
      SubChainId: true, 
      SubChainName: true, 
      ChainId: true,
      chains: {
        select: {
          ChainName: true
        }
      }
    },
  });

  console.log(`📋 Found ${subchains.length} subchains without images`);

  for (let i = 0; i < subchains.length; i++) {
    const { SubChainId, SubChainName, ChainId, chains } = subchains[i];
    const chainName = chains?.ChainName;
    
    if (!SubChainName && !chainName) {
      console.log(`⚠️ Skipping subchain with no names (ID: ${SubChainId})`);
      continue;
    }
    
    console.log(`\n📦 Processing ${i + 1}/${subchains.length}: ${SubChainName || chainName}`);
    console.log(`   🏪 SubChain: ${SubChainName || 'N/A'}`);
    console.log(`   🏢 Chain: ${chainName || 'N/A'}`);
    
    try {
      let imageUrl: string | null = null;
      
      // Try SubChainName first
      if (SubChainName) {
        console.log(`\n🔍 Trying SubChain name: ${SubChainName}`);
        imageUrl = await getSubChainImageFromHebrewWikipedia(SubChainName);
      }
      
      // If failed and ChainName is different, try ChainName as fallback
      if (!imageUrl && chainName && chainName !== SubChainName) {
        console.log(`\n🔄 Fallback to Chain name: ${chainName}`);
        imageUrl = await getSubChainImageFromHebrewWikipedia(chainName);
      }
      
      if (imageUrl) {
        await prisma.subchains.update({
          where: {
            ChainId_SubChainId: {
              ChainId,
              SubChainId,
            },
          },
          data: { imageUrl },
        });
        console.log(`✔️ Sub Chain image updated: ${SubChainName || chainName}`);
        console.log(`   📸 Image URL: ${imageUrl}`);
      } else {
        console.log(`❌ No image found for Sub Chain: ${SubChainName || chainName}`);
        console.log(`   🔍 Tried: ${SubChainName ? 'SubChain' : ''}${SubChainName && chainName && chainName !== SubChainName ? ' + Chain' : ''}${!SubChainName && chainName ? 'Chain' : ''} names`);
      }
      
      // Add a small delay to be respectful to Wikipedia
      await new Promise(resolve => setTimeout(resolve, 1500));
      
    } catch (error) {
      console.error(`💥 Error processing ${SubChainName || chainName}:`, error);
    }
  }
  
  console.log("\n🎉 Hebrew Wikipedia image scraping completed!");
}

// Export the function for potential use in other modules
export { getSubChainImageFromHebrewWikipedia };

// Run the main function
main()
  .catch((e) => {
    console.error("💥 Fatal error:", e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
