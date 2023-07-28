var whois = require('whois')
const { generateCombinations, sleep, shuffleArray } = require('./helpers')

// let names = ["xx", "alixx", "alixx2222", 'xo', 'x', 'x2222']
let names = shuffleArray(generateCombinations(40))

const domainIsAvailable = (domain) => new Promise((resolve, reject) => {
    whois.lookup(domain, function (err, data) {
        // console.log(data)
        if (err) return reject(err)
        if (data.includes('%ERROR:101: no entries found')) {
            return resolve(true)
        } else {
            return resolve(false)
        }
    })
})


const bulkWhois = async (names) => {
    const namesToCheck = [...names]

    for (domain of namesToCheck) {
        let isAvalable;
        try {
            isAvalable = await domainIsAvailable(domain + '.ir')
        } catch (error) {
            if (error.code === 'ECONNRESET' || error.message === "lookup: timeout") {
                console.log('Connection reset, retrying...')
                await sleep(2000)
                namesToCheck.push(domain)
            } else
                throw error
        }
        console.log(isAvalable);
        if (isAvalable)
            console.log(domain + '.ir is available')
    }
}
bulkWhois(names)
