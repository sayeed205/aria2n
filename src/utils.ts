export function humanReadableBytes(
    value: number,
    digits: number = 2,
    delim: string = '',
    postfix: string = ''
): string {
    let hrValue: number = value;
    let chosenUnit: string = 'B';
    const units: string[] = ['KiB', 'MiB', 'GiB', 'TiB'];

    for (const unit of units) {
        if (hrValue > 1000) {
            hrValue /= 1024;
            chosenUnit = unit;
        } else {
            break;
        }
    }

    return `${hrValue.toFixed(digits)}${delim}${chosenUnit}${postfix}`;
}
