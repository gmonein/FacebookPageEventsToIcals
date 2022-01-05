const puppeteer = require('puppeteer');
const CRED = require('./creds');
const fetch = require('node-fetch')
const { parseRealDate } = require('./real_date_parser')
const { appendFileSync, writeFileSync } = require('fs')
const ics = require('ics')
let loggedIn = false

const pageNames = process.argv.slice(2)

const sleep = async (ms) => {
  return new Promise((res, rej) => {
    setTimeout(() => {
      res();
    }, ms)
  });
}

const ID = {
  login: '#email',
  pass: '#pass'
};

(async () => {
  let events = []

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-notifications']
  });

  const page = await browser.newPage();

  const login = async () => {
    if (loggedIn) { return }
    // login
    await page.goto('https://fr-fr.facebook.com', {
      waitUntil: 'networkidle2'
    });
    await sleep(400)
    await page.waitForSelector(ID.login);
    await sleep(400)
    await page.type(ID.login, CRED.user);
    await sleep(400)
    await page.type(ID.pass, CRED.pass);
    await sleep(400)
    await page.type(ID.pass, "\n");
    await sleep(400)
    await page.waitForNavigation();
    loggedIn = true
  }
  const pushEvent = function(url, name, date) {
    events.push({
      date: date,
      url: url,
      title: name,
    })
  }

  const crawlUrl = async (pageUrl) => {
    await page.goto(pageUrl)

    await sleep(500)

    for (;;) {
      let last_event_length = events.length

      page.evaluate(_ => { Array.from(document.querySelectorAll('span')).find(el => el.textContent === 'Afficher la suite')?.click() })
      page.evaluate(_ => { window.scrollBy(0, window.innerHeight) + 100 });

      try {
        await new Promise(async function(resolve, reject) {
          setTimeout(() => {
            reject()
          }, 2000)
          for (;;) {
            await sleep(20)
            if (events.length != last_event_length) {
              resolve()
              break
            }
          }
        })
      } catch {
        break
      }
    }
  }

  page.on('response', async response => {
    const findJson = function(body, eventIndex) {
      let offset = 0
      let open = 0
      for (;;) {
        let index = eventIndex + offset
        if (body[index] == '{') { open += 1 }
        else if (body[index] == '}') { open -= 1 }

        offset += 1
        if (open == 0) { break }
      }

      return JSON.parse(body.slice(eventIndex, eventIndex + offset))
    }

    let url = response.url()
    let body = undefined

    if (url.endsWith("/events")) {
      try { body = await response.text() } catch {}
      if (!body) { return }

      eventIndex = body.indexOf('"upcoming_events":{')
      if (eventIndex == -1) { return }

      eventIndex = body.indexOf('{', eventIndex)
      let parsedResponse = findJson(body, eventIndex)
      parsedResponse.edges.forEach((node) => {
        pushEvent(node.node.url, node.node.name, parseRealDate(node.node.day_time_sentence))
      })
    }
    else if (url.endsWith("upcoming_hosted_events")) {
      try { body = await response.text() } catch {}
      let eventIndex = -1;
      for (; body;) {
        eventIndex = body.indexOf('{"__typename":"TimelineAppCollectionEventsRenderer', eventIndex + 1)
        if (eventIndex == -1) { break ; }

        let parsedResponse = findJson(body, eventIndex)
        let nodes = parsedResponse.collection.pageItems.edges

        nodes.forEach((node) => {
          pushEvent(node.node.node.url, node.node.node.name, parseRealDate(node.node.node.day_time_sentence))
        })
      }
    } else if (url.endsWith("graphql/")) {
      try { body = await response.text() } catch {}
      let eventIndex = -1;
     for (; body;) {
       eventIndex = body.indexOf('{"__typename":"Event"', eventIndex + 1)
       if (eventIndex == -1) { break ; }

       let parsedResponse = findJson(body, eventIndex)
       if (parsedResponse.name) {
         pushEvent(parsedResponse.url, parsedResponse.name, parseRealDate(parsedResponse.day_time_sentence))
       }
     }
    }
  });

  await page.goto('https://fr-fr.facebook.com', {
    waitUntil: 'networkidle2'
  });
  await page.waitForSelector(`[data-cookiebanner="accept_button"]`)
  page.click(`[data-cookiebanner="accept_button"]`)

  await sleep(800)

  for (let i = 0; i < pageNames.length; i++) {
    let pageName = pageNames[i]

    let pageUrl = `https://fr-fr.facebook.com/${pageName}/upcoming_hosted_events`
    let req = await fetch(pageUrl)
    if (req.status == 404) {
      pageUrl = `https://fr-fr.facebook.com/pg/${pageName}/events`
      req = await fetch(pageUrl)
      if (req.status == 404) { return ; }

      await login()
    }
    

    await crawlUrl(pageUrl)
  }

  writeFileSync(`events.ics`, 'BEGIN:VCALENDAR\r\n')
  events.forEach((e) => {
    if (!e.title) { return }
    let date = new Date (e.date) 
    let dateArray = [date.getYear() + 1900, date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()]
    ics.createEvent({title: e.title, start: dateArray, duration: { minutes: 15 }}, (error, value) => {
      if (error) { ; return}

      let eventString = value.split("\n").filter(e => { return (e != 'BEGIN:VCALENDAR\r' && e != 'END:VCALENDAR\r') } ).join("\n")
      appendFileSync('events.ics', eventString);
    })
  })
  appendFileSync(`events.ics`, 'END:VCALENDAR\r\n')
  console.log(`output file: ${process.env['PWD']}/events.ics`)
  process.exit()
})();
