import { EventEmitter } from 'events';

export class SignalHandler extends EventEmitter {
    private signals: NodeJS.Signals[];

    constructor(signals: NodeJS.Signals[]) {
        super();
        this.signals = signals;

        for (const sig of this.signals) {
            process.on(sig, () => this.handleSignal(sig));
        }
    }

    handleSignal(signal: NodeJS.Signals): void {
        console.log(`Received signal: ${signal}`);
        this.emit('signal', signal);
    }

    static create(handle_signals: boolean): SignalHandler | null {
        if (handle_signals) {
            return new SignalHandler(['SIGTERM', 'SIGINT']);
        }
        return null;
    }
}

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
