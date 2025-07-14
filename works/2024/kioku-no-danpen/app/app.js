document.addEventListener('DOMContentLoaded', () => {
    const puzzleGrid = document.getElementById('puzzle-grid');
    const messageContainer = document.getElementById('puzzle-message');
    const shuffleButton = document.getElementById('shuffle-button');

    const gridSize = 3;
    const numTiles = gridSize * gridSize;
    let tiles = [];
    
    const tilePositions = [];
    for (let i = 0; i < numTiles; i++) {
        tilePositions.push(i);
    }
    
    function createTile(index) {
        const tile = document.createElement('div');
        tile.classList.add('puzzle-piece');
        
        const row = Math.floor(index / gridSize);
        const col = index % gridSize;
        
        // The last piece is the empty one
        if (index === numTiles - 1) {
            tile.classList.add('empty');
        } else {
            tile.style.backgroundPosition = `${(col * 100) / (gridSize - 1)}% ${(row * 100) / (gridSize - 1)}%`;
        }

        tile.dataset.index = index;
        tile.addEventListener('click', () => onTileClick(tile));
        return tile;
    }

    function onTileClick(tile) {
        if (messageContainer.classList.contains('show')) return;

        const emptyTile = document.querySelector('.puzzle-piece.empty');
        if (!tile || tile.classList.contains('empty')) return;
        
        const tileIndex = tiles.indexOf(tile);
        const emptyIndex = tiles.indexOf(emptyTile);

        if (areAdjacent(tileIndex, emptyIndex)) {
            swapTiles(tileIndex, emptyIndex);
            checkWin();
        }
    }

    function areAdjacent(index1, index2) {
        const row1 = Math.floor(index1 / gridSize);
        const col1 = index1 % gridSize;
        const row2 = Math.floor(index2 / gridSize);
        const col2 = index2 % gridSize;

        return (Math.abs(row1 - row2) === 1 && col1 === col2) || (Math.abs(col1 - col2) === 1 && row1 === row2);
    }
    
    function swapTiles(index1, index2) {
        // Swap in the array
        [tiles[index1], tiles[index2]] = [tiles[index2], tiles[index1]];

        // Re-render the grid
        renderGrid();
    }

    function renderGrid() {
        puzzleGrid.innerHTML = '';
        tiles.forEach(tile => puzzleGrid.appendChild(tile));
    }
    
    function shuffle() {
        // Simple shuffle: perform a number of random valid moves
        let emptyIndex = numTiles - 1;
        for (let i = 0; i < 100; i++) {
            const emptyRow = Math.floor(emptyIndex / gridSize);
            const emptyCol = emptyIndex % gridSize;
            
            const neighbors = [];
            if (emptyRow > 0) neighbors.push(emptyIndex - gridSize); // Top
            if (emptyRow < gridSize - 1) neighbors.push(emptyIndex + gridSize); // Bottom
            if (emptyCol > 0) neighbors.push(emptyIndex - 1); // Left
            if (emptyCol < gridSize - 1) neighbors.push(emptyIndex + 1); // Right

            const randomIndex = neighbors[Math.floor(Math.random() * neighbors.length)];
            
            // Swap in the array
            [tilePositions[emptyIndex], tilePositions[randomIndex]] = [tilePositions[randomIndex], tilePositions[emptyIndex]];
            emptyIndex = randomIndex;
        }

        tiles = tilePositions.map(pos => createTile(pos));
        renderGrid();
    }

    function checkWin() {
        for(let i = 0; i < tiles.length; i++) {
            if (parseInt(tiles[i].dataset.index) !== i) {
                return false;
            }
        }
        showMessage(true);
        return true;
    }

    function showMessage(show) {
        if(show) {
            messageContainer.classList.remove('hidden');
            setTimeout(() => messageContainer.classList.add('show'), 10);
        } else {
            messageContainer.classList.remove('show');
             setTimeout(() => messageContainer.classList.add('hidden'), 500);
        }
    }
    
    function resetAndShuffle() {
        showMessage(false);
        setTimeout(() => {
            shuffle();
        }, 500);
    }
    
    // Initial setup
    shuffleButton.addEventListener('click', resetAndShuffle);
    resetAndShuffle();
});
