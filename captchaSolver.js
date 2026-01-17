// In solveV2ImageChallenge function:
for (const tile of analysis.matchingTiles) {
    const tileSelector = `.rc-imageselect-tile[tabindex="${tile.index}"]`;
    
    // NEW: Add Human Jitter to satisfy the risk analysis mentioned in the paper
    const rect = await challengeFrame.$eval(tileSelector, el => {
        const {top, left, width, height} = el.getBoundingClientRect();
        return {top, left, width, height};
    });

    // Randomize click within the tile (avoid clicking the exact center)
    const x = rect.left + (rect.width / 2) + (Math.random() * 10 - 5);
    const y = rect.top + (rect.height / 2) + (Math.random() * 10 - 5);

    await page.mouse.click(x, y, { delay: Math.random() * 100 + 50 });
    await sleep(Math.random() * 500 + 200); 
}