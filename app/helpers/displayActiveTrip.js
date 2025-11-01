const { success, error, warning, info, bold, dim, green, red, yellow, cyan, gray,
    doubleBoxTitle, doubleBoxLine, doubleBoxSeparator, doubleBoxBottom,
    boxTitle, boxLine, boxBottom, emoji } = require('../../colors');

function displayActiveTrip(currentTrip) {
    const width = 62;

    // Display active trip (after trip has been sent)
    const data = currentTrip.data;
    const tip = currentTrip.data.tip || 0;
    const baseFare = currentTrip.getBaseFare();
    const totalWithTip = currentTrip.getTotalAmount();
  
    console.log('\n' + doubleBoxTitle(`${emoji.pickup} ACTIVE TRIP DETAILS`, width));
    console.log(doubleBoxLine('', width));
  
    // Trip ID
    console.log(doubleBoxLine(bold(yellow(`${emoji.id} TRIP ID`)), width));
    console.log(doubleBoxLine(`  ${cyan(data.tripId)}`, width));
    console.log(doubleBoxLine('', width));
  
    // Rider Info
    console.log(doubleBoxLine(bold(yellow(`${emoji.rider} RIDER`)), width));
    console.log(doubleBoxLine(`  ${cyan(`${data.rider.data.firstName} ${data.rider.data.lastName}`)}`, width));
    console.log(doubleBoxLine(`  ${dim(`ID: ${data.rider.data.userId}`)}`, width));
    console.log(doubleBoxLine('', width));
  
    // Pickup Location
    console.log(doubleBoxLine(bold(yellow(`${emoji.pickup} PICKUP`)), width));
    console.log(doubleBoxLine(`  ${cyan(data.sourceLocation.title)}`, width));
    console.log(doubleBoxLine(`  ${dim(data.sourceLocation.fullAddress)}`, width));
    console.log(doubleBoxLine('', width));
  
    // Destination
    console.log(doubleBoxLine(bold(yellow(`${emoji.destination} DESTINATION`)), width));
    console.log(doubleBoxLine(`  ${cyan(data.destLocation.title)}`, width));
    console.log(doubleBoxLine(`  ${dim(data.destLocation.fullAddress)}`, width));
    console.log(doubleBoxLine('', width));
  
    // Fare Breakdown
    console.log(doubleBoxLine(bold(yellow(`${emoji.money} FARE BREAKDOWN`)), width));
    console.log(doubleBoxLine(`  Base Fare: ${green(`₱${baseFare.toFixed(2)}`)}`, width));
    if (tip > 0) {
      console.log(doubleBoxLine(`  Tip: ${green(`₱${tip.toFixed(2)}`)}`, width));
      console.log(doubleBoxLine(`  ${dim('─'.repeat(40))}`, width));
      console.log(doubleBoxLine(`  Total Amount: ${green(bold(`₱${totalWithTip.toFixed(2)}`))}`, width));
    } else {
      console.log(doubleBoxLine(`  Tip: ${dim('No tip added')}`, width));
      console.log(doubleBoxLine(`  ${dim('─'.repeat(40))}`, width));
      console.log(doubleBoxLine(`  Total Amount: ${green(bold(`₱${baseFare.toFixed(2)}`))}`, width));
    }
    console.log(doubleBoxLine('', width));
  
    // Status
    console.log(doubleBoxLine(bold(yellow(`${emoji.info} STATUS`)), width));
    console.log(doubleBoxLine(`  ${yellow('Looking for drivers...')}`, width));
    console.log(doubleBoxLine('', width));
  
    // Available Actions
    console.log(doubleBoxLine(dim(`Available commands:`), width));
    console.log(doubleBoxLine(`  ${cyan('add_tip <amount>')} - ${tip > 0 ? 'Update tip amount' : 'Add a tip'}`, width));
    console.log(doubleBoxLine('', width));
  
    console.log(doubleBoxBottom(width) + '\n');
}

module.exports = displayActiveTrip;