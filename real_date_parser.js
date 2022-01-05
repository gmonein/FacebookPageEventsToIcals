const weekdays = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI']
const weekdaysShort = weekdays.map((e) => { e.slice(0, 3) })
const months = ["JANV.", "FÉVR.", "MARS", "AVR.", "MAI", "JUIN", "JUIL.", "AOÛT", "SEPT.", "OCT.", "NOV.", "DÉC."]
const monthsShort = months.map((e) => { e.slice(0, 3) })

function parseRealDate(textDate) {
  if (!textDate) { return }

  let date = new Date
  let month = date.getMonth()
  let day = date.getDate()
  let year = date.getYear() + 1900

  let splitDate = textDate.split(' ')
  if (splitDate[0] == 'MAINTENANT') { return date }

  let hours = date.getHours()
  let minutes = date.getMinutes()

  const hoursStart = splitDate.indexOf('À')
  if (hoursStart != -1) {
    let hoursMinutesSplit = splitDate[hoursStart + 1].split(':').map(e => parseInt(e))
    hours = hoursMinutesSplit[0]
    minutes = hoursMinutesSplit[1]

    if (splitDate[hoursStart + 2] == 'UTC+01') { hours += 1 }
  }

  switch (splitDate[0]) {
    case 'MAINTENANT':
      break
    case 'AUJOURD’HUI':
      break
    case 'CE':
      let weekday = weekdays.indexOf(splitDate[1]) + 1
      day = date.getDate() - date.getDay() + weekday
      break
    default:
      day = parseInt(splitDate[1])
      month = months.indexOf(splitDate[2])
      if (month == -1) { month = monthsShort.indexOf(splitDate[2]) }
      if (splitDate[3].startsWith('2')) { year = parseInt(splitDate[3]) }

    date = new Date(year, month, day, hours, minutes)
  }

  return date
}

exports.parseRealDate = parseRealDate
