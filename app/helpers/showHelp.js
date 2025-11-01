const { success, error, warning, info, bold, dim, green, red, yellow, cyan, gray,
    doubleBoxTitle, doubleBoxLine, doubleBoxSeparator, doubleBoxBottom,
    boxTitle, boxLine, boxBottom, emoji } = require('../../colors');

// CLI commands
function showHelp() {
    const width = 62;
    console.log('\n' + boxTitle('RIDER CLIENT COMMANDS', width));
    console.log(boxLine('', width));
    console.log(boxLine(bold('Connection:'), width));
    console.log(boxLine(`  ${cyan('connect')}               ${dim('- Connect to the server')}`, width));
    console.log(boxLine(`  ${cyan('disconnect')}            ${dim('- Disconnect from server')}`, width));
    console.log(boxLine('', width));
    console.log(boxLine(bold('Display Info:'), width));
    console.log(boxLine(`  ${cyan('display_riders')}        ${dim('- Show all available riders')}`, width));
    console.log(boxLine(`  ${cyan('display_drivers')}       ${dim('- Show all available drivers')}`, width));
    console.log(boxLine(`  ${cyan('display_locations')}     ${dim('- Show all available locations')}`, width));
    console.log(boxLine('', width));
    console.log(boxLine(bold('Identity & Location:'), width));
    console.log(boxLine(`  ${cyan('assume_rider "name"')}   ${dim('- Assume rider identity')}`, width));
    console.log(boxLine(`  ${cyan('assume_location "loc"')} ${dim('- Set current location')}`, width));
    console.log(boxLine('', width));
    console.log(boxLine(bold('Trip:'), width));
    console.log(boxLine(`  ${cyan('book_trip "from" "to" [delay]')} ${dim('- Book a trip')}`, width));
    console.log(boxLine(`  ${cyan('compute_fare "from" "to"')} ${dim('- Estimate trip fare')}`, width));
    console.log(boxLine(`  ${cyan('display_trip')} ${dim('- Show current trip details')}`, width));
    console.log(boxLine(`  ${cyan('cancel_booking')} ${dim('- Cancel pending booking')}`, width));
    console.log(boxLine(`  ${cyan('add_tip <amount>')} ${dim('- Add tip to pending booking')}`, width));
    console.log(boxLine('', width));
    console.log(boxLine(bold('Other:'), width));
    console.log(boxLine(`  ${cyan('status')}                ${dim('- Show current status')}`, width));
    console.log(boxLine(`  ${cyan('help')}                  ${dim('- Show this help menu')}`, width));
    console.log(boxLine(`  ${cyan('exit')}                  ${dim('- Exit the client')}`, width));
    console.log(boxLine('', width));
    console.log(boxBottom(width) + '\n');
}

module.exports = showHelp;