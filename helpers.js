function generateCombinations(length) {
    const characters = 'abcdefghijklmnopqrstuvwxyz';
    const base = characters.length;

    let result = [];
    let numCombinations = Math.pow(base, length);

    for (let i = 0; i < numCombinations; i++) {
        let curCombination = '';
        let num = i;

        // Generate a string for the current combination
        for (let j = 0; j < length; j++) {
            let index = num % base;
            curCombination += characters[index];
            num = Math.floor(num / base);
        }

        result.push(curCombination);
    }

    return result;
}

// Example usage:
// console.log(generateCombinations(3));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function shuffleArray(array) {
    const shuffledArray = [...array]
    for (var i = shuffledArray.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = shuffledArray[i];
        shuffledArray[i] = shuffledArray[j];
        shuffledArray[j] = temp;
    }
    return shuffledArray
}


// console.log(shuffleArray([2, '1', '2', '3']));

module.exports = {
    generateCombinations, sleep, shuffleArray
}
