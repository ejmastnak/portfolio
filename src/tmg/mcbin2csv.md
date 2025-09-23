---
title: MCbin2csv
---

# Reverse engineering the structure of binary sensor data

In this project, I'm tasked with turning a binary data dump like this:

```txt
# xxd data.bin -b -cols 8 | head -n 8
00000000: 01101101 01110011 10100010 00001010 10100000 00001111 01000000 00011111  ms....@.
00000008: 00000000 00000000 01111000 00000010 00110010 00000101 10000101 00000011  ..x.2...
00000010: 00111100 00000011 00110000 11111001 11010000 00000011 01100000 11111001  <.0...`.
00000018: 01000000 00101001 00010000 11101000 00000000 11001111 01011010 01011010  @)....ZZ
00000020: 00100010 01110111 10100010 00001010 10100000 00001111 01000000 00011111  "w....@.
00000028: 00000000 00000000 01111001 00000010 00110001 00000101 10000110 00000011  ..y.1...
00000030: 00111011 00000011 00010000 11111001 11110000 00000011 01100000 11111001  ;.....`.
00000038: 01000000 00100111 10100000 11100101 11100000 11010011 01011010 01011010  @'....ZZ
# ...
```

...into human-usable data like this:

```csv
# TIMESTAMP,BATVOLT,SYSTEMP,EXTRIG,INAN01,INAN02,INAN03,INAN04,ACC1X,ACC1Y,ACC1Z,ACC2X,ACC2Y,ACC2Z,ENDMARKER
0.000000,4.000,31.250,0,0.509,1.072,0.726,0.667,-0.654,0.366,-0.636,0.660,-0.383,-0.784,23130
0.000949,4.000,31.250,0,0.510,1.071,0.727,0.666,-0.666,0.378,-0.636,0.628,-0.422,-0.706,23130
# ...
```

This write-up walks you through my thought process and implementation.

Original documentation or source code were unavailable, but the task is made relatively straightforward by the availability of known decoded data matched to binary input data, which I could use as a source of truth to reverse engineer the decoding algorithm.

## A bit of context

The client has a measurement instrument used in-house during R&D for logging muscle activity and movement (a set of strain gauges, accelerometers, and a gyroscope in one box).
The measurement instrument is used with a **data logger** that performs amplification, analog filtering, and analog-to-digital conversion.
The logger produces binary data files, which are transferred from the logger to a desktop computer over a USB interface.

A **separate Windows desktop program decodes the binary files** from the data logger into human-readable CSV files. The decoding program was created by a separate contractor in the 2010s.
The program is currently suboptimal because of (primarily) the difficulty of transferring the program to new computers—license transfer, compatibility with modern Windows, etc. effectively ties the decoding program to a few old laptops—and (secondarily) a clunky GUI.

**My goal** is to reimplement the decoding program in a more practicable form.
Specific goals are to:

- Reverse engineer the binary-to-CSV parsing algorithm
- Document the structure of the binary data coming out of the data logger (width in bytes, datatype, and scale factors for each channel)
- Create a new version of the decoder program:

  1. Behind a GUI interface as a web app, to solve existing installation, license transfer, and cross-platform compatibility issues, etc.
  2. As a minimal C program (in the spirit of `bin2csv intput.bin output.txt`) for programmatic use

## Problem specification

We are given:

1. A binary file `data.bin` representing a stream of multi-channel readings from the data logger.
   The binary file looks like this:


   ```txt
   # xxd data.bin -b -cols 8 | head -n 8
   00000000: 01101101 01110011 10100010 00001010 10100000 00001111 01000000 00011111  ms....@.
   00000008: 00000000 00000000 01111000 00000010 00110010 00000101 10000101 00000011  ..x.2...
   00000010: 00111100 00000011 00110000 11111001 11010000 00000011 01100000 11111001  <.0...`.
   00000018: 01000000 00101001 00010000 11101000 00000000 11001111 01011010 01011010  @)....ZZ
   00000020: 00100010 01110111 10100010 00001010 10100000 00001111 01000000 00011111  "w....@.
   00000028: 00000000 00000000 01111001 00000010 00110001 00000101 10000110 00000011  ..y.1...
   00000030: 00111011 00000011 00010000 11111001 11110000 00000011 01100000 11111001  ;.....`.
   00000038: 01000000 00100111 10100000 11100101 11100000 11010011 01011010 01011010  @'....ZZ
   # ...
   ```

1. A corresponding plain-text log file `data.log` from the data logger recording which channels were active during the measurement.
   The log file looks like this:

   ```txt
   SAMPLING_DATA_RATE 1000
   FILE_LOG_TIMESTAMP 1
   FILE_LOG_BATVOLT 1
   FILE_LOG_SYSTEMP 1
   FILE_LOG_EXTRIG 1
   FILE_LOG_INAN01 1
   FILE_LOG_INAN02 1
   FILE_LOG_INAN03 1
   FILE_LOG_INAN04 1
   FILE_LOG_ACC1X 1
   FILE_LOG_ACC1Y 1
   FILE_LOG_ACC1Z 1
   FILE_LOG_GYR1X 0
   FILE_LOG_GYR1Y 0
   FILE_LOG_GYR1Z 0
   FILE_LOG_GYR1T 0
   FILE_LOG_MAG1X 0
   FILE_LOG_MAG1Y 0
   FILE_LOG_MAG1Z 0
   FILE_LOG_ACC2X 1
   FILE_LOG_ACC2Y 1
   FILE_LOG_ACC2Z 1
   FILE_LOG_CHECKSUM 0
   FILE_LOG_ENDMARKER 1
   ```

1. A CSV file with the decoded output of the binary file, produced by the original decoding program.
   Here is an example of decoded output:

   ```csv
   # TIMESTAMP,BATVOLT,SYSTEMP,EXTRIG,INAN01,INAN02,INAN03,INAN04,ACC1X,ACC1Y,ACC1Z,ACC2X,ACC2Y,ACC2Z,ENDMARKER
   0.000000,4.000,31.250,0,0.509,1.072,0.726,0.667,-0.654,0.366,-0.636,0.660,-0.383,-0.784,23130
   0.000949,4.000,31.250,0,0.510,1.071,0.727,0.666,-0.666,0.378,-0.636,0.628,-0.422,-0.706,23130
   0.001987,4.000,31.250,0,0.508,1.072,0.726,0.666,-0.654,0.330,-0.648,0.680,-0.407,-0.759,23130
   0.002990,4.000,31.250,0,0.509,1.072,0.726,0.667,-0.612,0.336,-0.612,0.701,-0.432,-0.715,23130
   0.004040,4.000,31.250,0,0.511,1.072,0.727,0.665,-0.690,0.360,-0.606,0.701,-0.375,-0.718,23130
   ```

Source code or documentation for the original decoding program were unavailable, but the availability of raw binary data and corresponding decoded CSV files make the task relatively straightforward.

## Vocabulary

I will use the following terms:

- **Channel**: a column of the CSV file, i.e. a single variable or physical quantity being recorded by the data logger, e.g. `BATVOLT` (battery voltage), `INAN01` (analog input 1), etc.
- **Frame**: a single row of the CSV file, i.e. a single multi-channel sample taken by the data-logger. For instance, `0.000000,4.000,31.250,0,0.509,1.072,0.726,0.667,-0.654,0.366,-0.636,0.660,-0.383,-0.784,23130` is the first frame of the CSV file
- **`data.bin`** to denote a generic binary file taken from the data logger
- **`data.log`** the plain-text log file accompanying `data.bin`
- **`data.csv`** to denote a decoded, human-readable, CSV version of `data.bin`

```csv
# TIMESTAMP,BATVOLT,SYSTEMP,EXTRIG,INAN01,INAN02,INAN03,INAN04,ACC1X,ACC1Y,ACC1Z,ACC2X,ACC2Y,ACC2Z,ENDMARKER
0.000000,4.000,31.250,0,0.509,1.072,0.726,0.667,-0.654,0.366,-0.636,0.660,-0.383,-0.784,23130
0.000949,4.000,31.250,0,0.510,1.071,0.727,0.666,-0.666,0.378,-0.636,0.628,-0.422,-0.706,23130
0.001987,4.000,31.250,0,0.508,1.072,0.726,0.666,-0.654,0.330,-0.648,0.680,-0.407,-0.759,23130
0.002990,4.000,31.250,0,0.509,1.072,0.726,0.667,-0.612,0.336,-0.612,0.701,-0.432,-0.715,23130
0.004040,4.000,31.250,0,0.511,1.072,0.727,0.665,-0.690,0.360,-0.606,0.701,-0.375,-0.718,23130
```

## Hex dump

Initial questions I wanted to investigate:

- In the binary data file from the data logger, where does each frame end and the next frame begin?
- What is the data type of each channel (uint16, int32, float32, etc.)?
- What units is each channel measured in?
- What conversions/scaling/transformations, if any, are needed to convert raw sensor readings to physical values in correct units?

First: I begin with a hex dump of a sample binary file `data.bin`:

```bash
# Hex dump a binary file
xxd data.bin > data.txt
```

#### Hex dump {#data-hex}

The first 128 bytes of `data.bin` in hex are:

```txt
00000000: 6d73 a20a a00f 401f 0000 7802 3205 8503  ms....@...x.2...
00000010: 3c03 30f9 d003 60f9 4029 10e8 00cf 5a5a  <.0...`.@)....ZZ
00000020: 2277 a20a a00f 401f 0000 7902 3105 8603  "w....@...y.1...
00000030: 3b03 10f9 f003 60f9 4027 a0e5 e0d3 5a5a  ;.....`.@'....ZZ
00000040: 307b a20a a00f 401f 0000 7702 3305 8503  0{....@...w.3...
00000050: 3b03 30f9 7003 40f9 802a 90e6 90d0 5a5a  ;.0.p.@..*....ZZ
00000060: 1b7f a20a a00f 401f 0000 7802 3305 8503  ......@...x.3...
00000070: 3c03 a0f9 8003 a0f9 d02b 00e5 50d3 5a5a  <........+..P.ZZ
```

#### Decoded data {#data-csv}

I am also given a CSV file `data.csv` known to contain the decoded data in `data.bin`.
The corresponding first few lines of `data.csv` are:

```csv
0.0,4.0,31.25,0.0,0.50918,1.071533,0.725903,0.66709,-0.654,0.366,-0.636,0.66,-0.383,-0.784,23130.0
9.49E-4,4.0,31.25,0.0,0.509985,1.070728,0.726709,0.666284,-0.666,0.378,-0.636,0.628,-0.422,-0.706,23130.0
0.001987,4.0,31.25,0.0,0.508374,1.072339,0.725903,0.666284,-0.654,0.33,-0.648,0.68,-0.407,-0.759,23130.0
0.00299,4.0,31.25,0.0,0.50918,1.072339,0.725903,0.66709,-0.612,0.336,-0.612,0.701,-0.432,-0.715,23130.0
0.00404,4.0,31.25,0.0,0.510791,1.071533,0.726709,0.665479,-0.69,0.36,-0.606,0.701,-0.375,-0.718,23130.0
0.004989,4.0,31.25,0.0,0.50918,1.07395,0.726709,0.665479,-0.672,0.354,-0.636,0.668,-0.383,-0.75,23130.0
0.006005,4.0,31.25,0.0,0.509985,1.070728,0.727515,0.665479,-0.75,0.33,-0.648,0.672,-0.407,-0.783,23130.0
0.006981,4.0,31.25,0.0,0.509985,1.071533,0.725098,0.66709,-0.702,0.39,-0.648,0.672,-0.347,-0.722,23130.0
```

::: details Jumping ahead a bit to scale factors... {open}
Jumping ahead to the question of guessing the data type of each column, note that the values in the decoded CSV are floating point.
This is in all likelihood deceiving—under the hood, the values in `data.csv` come directly out of an ADC, which produces only integer values.

The fact that we see floating point numbers in the CSV suggests we will need to also find scale factors by which we divide/multiply the raw ADC readings to get the "appearingly" floating point values in the CSV.

(All sensors that rely on an ADC fundamentally work this way, and "appearingly" floating-point human-facing readings are found by dividing an integer value coming out of the ADC by a sensor-dependent calibration factor that would normally be given in the sensor's data sheet.)
:::

#### Log file {#data-log}

The binary file `data.bin` is accompanied by the following log file:

```txt
SAMPLING_DATA_RATE 1000
FILE_LOG_TIMESTAMP 1
FILE_LOG_BATVOLT 1
FILE_LOG_SYSTEMP 1
FILE_LOG_EXTRIG 1
FILE_LOG_INAN01 1
FILE_LOG_INAN02 1
FILE_LOG_INAN03 1
FILE_LOG_INAN04 1
FILE_LOG_ACC1X 1
FILE_LOG_ACC1Y 1
FILE_LOG_ACC1Z 1
FILE_LOG_GYR1X 0
FILE_LOG_GYR1Y 0
FILE_LOG_GYR1Z 0
FILE_LOG_GYR1T 0
FILE_LOG_MAG1X 0
FILE_LOG_MAG1Y 0
FILE_LOG_MAG1Z 0
FILE_LOG_ACC2X 1
FILE_LOG_ACC2Y 1
FILE_LOG_ACC2Z 1
FILE_LOG_CHECKSUM 0
FILE_LOG_ENDMARKER 1
```

This gives us:

- a sample rate (`SAMPLING_DATA_RATE 1000` suggests 1000 Hz),
- a good idea of what each channel/CSV column represents (e.g. `FILE_LOG_BATVOLT` is very likely the data logger's battery voltage, `FILE_LOG_INAN01` is probably "analog input 1", `FILE_LOG_ACC1X` is the x-axis reading from accelerometer 1, etc),
- what in all likelihood are boolean on/off values indicating which sensor channels the data logger is recording during a given measurement.
  (Indeed, there are 15 enabled channels—those with a `1`—in `data.log` and 15 columns in the decoded `data.csv`.)

## When does each frame end?

The goal here is to identify when each frame ends and the next frame begins, which will tell use the width in bits of a frame.

A few repeating values jump out in the CSV—`4.0` in the second column, `31.25` in the third, `0.0` in the third, and `23130.0` at the end of each row.

I'll begin with `23130.0` in the final column.
The log file `data.log` calls the last enabled channel `FILE_LOG_ENDMARKER`, suggesting `23130` is some hard-coded EOL marker placed at the end of every frame.

Let's find the `23130` in the binary file! For review, the first 128 bytes are:

```txt
00000000: 6d73 a20a a00f 401f 0000 7802 3205 8503  ms....@...x.2...
00000010: 3c03 30f9 d003 60f9 4029 10e8 00cf 5a5a  <.0...`.@)....ZZ
00000020: 2277 a20a a00f 401f 0000 7902 3105 8603  "w....@...y.1...
00000030: 3b03 10f9 f003 60f9 4027 a0e5 e0d3 5a5a  ;.....`.@'....ZZ
00000040: 307b a20a a00f 401f 0000 7702 3305 8503  0{....@...w.3...
00000050: 3b03 30f9 7003 40f9 802a 90e6 90d0 5a5a  ;.0.p.@..*....ZZ
00000060: 1b7f a20a a00f 401f 0000 7802 3305 8503  ......@...x.3...
00000070: 3c03 a0f9 8003 a0f9 d02b 00e5 50d3 5a5a  <........+..P.ZZ
```

The value 16-bit value `5a5a` appears regularly and indeed decodes to `23130` when interpreted as `int16` or `uint16`.
Coincidentally, `5a5a` is also "ZZ" in ASCII; perhaps the use of ZZ as an end marker is intentional, either as a reference to the last letter of the English alphabet, or perhaps to (one of the many) shortcut(s) for closing a file in Vim?


::: details Endianness {open}
The hex value `5a5a` heppens to decode to `23130` in both little and big endian byte order.
This is because the first and seconds bytes are the same (both are `5a`), making byte order immaterial in this particular case.

In other words, matching `5a5a` to `23130` in the `ENDMARKER` column does not give away the binary data's byte order.
But we have every reason to assume little-endian order, which is ubiquitous on modern machines.
(And indeed we'll soon see the binary data is little-endian when decoding other data column.)
:::

In any case, identifying `a5a5` as the last portion of each frame also tells the length in bytes of each frame: since we're interpreting `5a5a` as an end-of-line marker and see that it repeats at the end of a 32-byte sequence, each frame must be 32 bytes long (in the specific measurement file we're dealing with—if a different combination of enabled channels would of course change the length of each frame).

**Takeaways so far:**

- Each frame ends with the sequence `a5a5`
- The ENDMARKER column is a 16-bit integer (more on signedness below)
- Each frame is 32 bytes long

## How long is each channel?

Next question: how many bytes does each channel take up?

We are given the information that the the data logger uses a 16-bit ADC, so any channels corresponding to readings from analog sensors will be 16 bits long.
However, other channels (e.g. timestamp, system temperature, checksum, etc) could be added on post-hoc by the data logger at a separate stage, and we can't assume a priori that they are also 16 bits wide.

For review, [the log file](#data-log) showed 15 channels enabled, and we identified the 16-bit `ENDMARKER` channel, leaving 14 channels to identify in the particular `data.bin` we are investigating.
After allotting 2 bytes of the 32-byte frame to the `ENDMARKER` channel, there are `32-2 = 30` bytes among which the remaining 14 channels could be allocated.

So how to allocate 30 bytes to 14 channels?
The most obvious permutation to test is each remaining channel being 16 bits (2 bytes) wide.
But this uses only `2*14 = 28` of the remaining 30 bytes, which doesn't check out.

So what other combinations that give 30 bytes are possible (and make sense)?

- We could have 13 16-bit channels and one 32-bit channel to get `13*2 + 1*4 = 30` total bytes.
- We could also have various configurations of 32, 16, and 8-bit channels.
  The most likely would be two 8-bit, ten 16-bit, and two 32-bit channels to get `2*1 + 10*2 + 2*4 = 30`.
  But that would require two 8-bit channels, and I don't see more than one good candidate for an 8-bit data type other than `EXTRIG`, which is presumably an on/off boolean value from an external trigger.
  Any other configurations would require even more 8-bit data types, so **I'm assuming thirteen 16-bit channels and one 32-bit channel**.

**Takeaway:** after accounting for the 16-bit `ENDMARKER` channel, each frame most likely consists of thirteen 16-bit channels and one 32-bit channel.

## Which is the 32-bit channel?

The next step is to identify the 32-bit channel.
For review, here is the `data.log` file showing channel names:

```txt
SAMPLING_DATA_RATE 1000
FILE_LOG_TIMESTAMP 1
FILE_LOG_BATVOLT 1
FILE_LOG_SYSTEMP 1
FILE_LOG_EXTRIG 1
FILE_LOG_INAN01 1
FILE_LOG_INAN02 1
FILE_LOG_INAN03 1
FILE_LOG_INAN04 1
FILE_LOG_ACC1X 1
FILE_LOG_ACC1Y 1
FILE_LOG_ACC1Z 1
FILE_LOG_GYR1X 0
FILE_LOG_GYR1Y 0
FILE_LOG_GYR1Z 0
FILE_LOG_GYR1T 0
FILE_LOG_MAG1X 0
FILE_LOG_MAG1Y 0
FILE_LOG_MAG1Z 0
FILE_LOG_ACC2X 1
FILE_LOG_ACC2Y 1
FILE_LOG_ACC2Z 1
FILE_LOG_CHECKSUM 0
FILE_LOG_ENDMARKER 1
```

Some quick reasoning: the analog input (`INAN0{1,2,3,4}`), accelerometer (`ACC1{X,Y,Z}`, `ACC2{X,Y,Z}`), gyroscope (`GYR1{X,Y,Z,T}`), and magnetometer (`MAG1{X,Y,Z}`) channels come in triplets/quadruplets that are all but certain to be the same data type, so they must all come from the 16-bit pool (and these are all but certainly readings from analog sensors passing through the onboard 16-bit ADC).

That leaves only a few candidates; the 32-bit channel must be one of:

```txt
# Which of these is the 32-bit channel?
TIMESTAMP 1
BATVOLT 1
SYSTEMP 1
EXTRIG 1
```

`EXTRIG` is unlikely, since this is probably a boolean on/off value and doesn't merit 32-bit resolution.
`TIMESTAMP` seems most likely: the data logger can record for multiple minutes at 1 kHz sampling. 
Assuming one unique timestamp per sample, a few minutes at 1 kHz would require more unique timestamps than 16 bits provides (e.g. running for 90 seconds at 1 kHz produces `90*1000 = 90000` datapoints, far above `2^16 = 65536`).

## Verifying 32 bit TIMESTAMPs

Let's see what happens if we allocate 32 bits to `TIMESTAMP`.
The log file tells us that the timestamp channel comes first in each frame, so we'll interpret the first 32 bits of each frame as a 32-bit integer and compare to the CSV output.
We have the choice of `int32` or `uint32`, but `uint32` is more likely for a timestamp, where it makes no sense to waste a bit on signed data.

From [the CSV file](#data-csv), the first 8 timestamps are:

```txt
0.0
9.49E-4
0.001987
0.00299
0.00404
0.004989
0.006005
0.006981
```

...while from [the hex dump](#data-hex), the first 32 bits of the first 8 lines are:

```txt
6d73 a20a
2277 a20a
307b a20a
1b7f a20a
3583 a20a
ea86 a20a
e28a a20a
b28e a20a
```

The corresponding decimal values (interpretted the hex values as little-endian 32-bit unsigned integers) are:

```txt
178418541
178419490
178420528
178421531
178422581
178423530
178424546
178425522
```

Or, starting at zero (i.e. subtracting the initial `178418541` from each value):

```txt
0
949
1987
2990
4040
4989
6005
6981
```

The differences between these values are about 1000:

```txt
949
1038
1003
1050
949
1016
976
```

:::details Quick review: conversion of e.g. `6d73a20a` (hex) to `178418541` (decimal)
The first timestamp value is `6d73a20a` in the hex dump, which I've quoted as `178418541` in decimal.

Quick review of the conversion: The hex dump uses little-endian byte order, with the LSB first (loosely, the bytes are "in reverse order").
In more intuitive big-endian format, the first timestamp is `0aa2736d`. 
Converting the 32-bit value `0aa2736d` from hex to decimal (recall `a = 10`, `d = 13`) gives `0*16^7 + 10*16^6 + 10*16^5 + 2*16^4 + 7*16^3 + 3*16^2 + 6*16^1 + 13*16^0 = 178418541`.
:::

**Interpretation:** These values make sense for a timestamp—they are uniformly increasing in (roughly) constant increments.
This also gives away the unit of the `TIMESTAMP` column: the log file tells us that the data logger is reading data at 1 kHz, or 1 sample every 1 ms. So the `TIMESTAMP` column must be in microseconds. This `TIMESTAMP` value is probably added by the data logger, e.g. by accessing an onboard hardware timer set to tick at the logger's sample rate.

**Takeaways:**

- The `TIMESTAMP` channel has units of microseconds
- The `TIMESTAMP` channel is 32 bits wide
- All remaining channels must be 16 bits wide (see [How long is each channel?](how-long-is-each-channel))

## Interpretting signedness

Next question: how, if at all, should signedness be introduced to each channel? (We see in the source-of-truth CSV that some columns have negative values, so signedness must come into play somewhere.)
Should any of the binary values coming out of the ADC be interpretted as signed data (e.g. an `int16` or `int32`)?
Will scaling and level-shifting need to be performed post-hoc in software?

We don't have original documentation, but common sense and access to the decoded source-of-truth `data.csv` will get us pretty far here.

For review, channels are:

```txt
TIMESTAMP (timestamp)
BATVOLT (battery voltage)
SYSTEMP (sensor temperature)
EXTRIG (trigger yes/no)
INAN0{1,2,3,4} (analog inputs)
ACC1{X,Y,Z} (accelerometer 1)
GYR1{X,Y,Z} (gyroscope)
MAG1{X,Y,Z} (magnetometer)
ACC2{X,Y,Z} (accelerometer 2)
CHECKSUM 0 (checksum)
ENDMARKER (constant end-of-line marker)
```

::: details TLDR {open}
It turns out that interpretting the values in the `INAN`, `ACC`, `GYR`, and `MAG` columns as signed integers (`int16`) and all other values as unsigned (`uint32` for `TIMESTAMP`; `uint16` for other channels) followed by simple multiplicative scaling produces values that agree out of the box with the source-of-truth CSV, without need for additional level shifting.
:::

The big picture: any value coming out of an ADC is fundamentally unsigned, in the sense that the ADC simply maps where an analog input signal falls on a monotonic scale from the ADC's low reference potential to its high reference potential.

However, an analog sensor that produces fundamentally signed data (like an accelerometer or gyroscope, where resignedness encodes direction of the underlying vector quantity being measured) can be level-shifted with analog circuitry so that its zero output falls halfway between the ADCs reference values; I'll call this halfway point `V0`.
In this case the sensor's zero value maps to `V0`, negative values below `V0`, and positive values above `V0`, and the ADC's output can be directly interpretted as two's complement signed integers. As far as I am aware, this setup is relatively common with analog accelerometers, gyroscopes, and magnetometers, and I believe this level-shifting of analog sensor outputs to mid-supply is what ended up happening in this case.

My condensed though process for each channel.

- `TIMESTAMP` (32-bit timestamp): almost surely unsigned, both by convention and common sense.
  Negative time makes no sense in a timestamp, and there is no reason the original designers would have wasted a bit on signed data. Try `uint32` and compare to `data.csv`.
- `INAN0{1,2,3,4}` (16-bit analog inputs from strain gauges): values in `data.csv` are signed, so signedness must be introduced somewhere. Try first interpreting as two's complement `int16` (perhaps a bipolar ADC is used to handle positie/negative swings the bridge's differential output, or level shifting is done with analog circuitry); if this doesn't produce values agreeing with `data.csv`, I'll have to look into level-shifting in software.
- `ACC1{X,Y,Z}` and `ACC2{X,Y,Z}` (16-bit accelerometer inputs): presumably biased to mid-supply; try two's complement `int16` and compare to `data.csv`; reevaluate if needed.
- `GYR1{X,Y,Z,T}` (16-bit gyroscope data): as for `ACC`—try `int16` and reevaluate if needed. 
- `BATVOLT`: this will be an inherently unipolar signal in practice (unlike directional vector signals from e.g. an accelerometer), so assume `uint16` output and perform scaling as needed in software.
- `SYSTEMP`: as for `BATVOLT`—assume `uint16` and scale as needed.
- `EXTRIG`: as far as I can tell from decoded CSV files, this channel is only ever 1 or 0 and represents a boolean on/off external trigger, so use the more semantically appropriate `uint16` (even though in practice, if the value is really only 0 or 1, you *could* get away with signed data, too—there is no risk of overflow assuming only 1/0 values).
- `CHECKSUM`: all that matters in a checksum is the raw bit sequence, so signedness is meaningless. Use `uint16`.
- `ENDMARKER`: similarly, all that matters in an end marker is that the same constant bit sequence appears at the end of every frame. Signedness is meaningless—use `uint16`.

**Sign encoding:** In the absence of information to the contrary, I'm assuming all signed channels use industry-standard two's complement encoding.

## Scale factors

Assuming the data types determined above (e.g. uint32 `TIMESTAMP`, int16 `ACC1X`, etc.), the first 8 frames of the binary data in `data.bin` decode to:

```txt
0,4000,8000,0,632,1330,901,828,-1744,976,-1696,10560,-6128,-12544,23130
949,4000,8000,0,633,1329,902,827,-1776,1008,-1696,10048,-6752,-11296,23130
1987,4000,8000,0,631,1331,901,827,-1744,880,-1728,10880,-6512,-12144,23130
2990,4000,8000,0,632,1331,901,828,-1632,896,-1632,11216,-6912,-11440,23130
4040,4000,8000,0,634,1330,902,826,-1840,960,-1616,11216,-6000,-11488,23130
4989,4000,8000,0,632,1333,902,826,-1792,944,-1696,10688,-6128,-12000,23130
6005,4000,8000,0,633,1329,903,826,-2000,880,-1728,10752,-6512,-12528,23130
6981,4000,8000,0,633,1330,900,828,-1872,1040,-1728,10752,-5552,-11552,23130
```

The corresponding first 8 lines from the source-of-truth, decoded CSV `data.csv` are:

```csv
0.0,4.0,31.25,0.0,0.50918,1.071533,0.725903,0.66709,-0.654,0.366,-0.636,0.66,-0.383,-0.784,23130.0
9.49E-4,4.0,31.25,0.0,0.509985,1.070728,0.726709,0.666284,-0.666,0.378,-0.636,0.628,-0.422,-0.706,23130.0
0.001987,4.0,31.25,0.0,0.508374,1.072339,0.725903,0.666284,-0.654,0.33,-0.648,0.68,-0.407,-0.759,23130.0
0.00299,4.0,31.25,0.0,0.50918,1.072339,0.725903,0.66709,-0.612,0.336,-0.612,0.701,-0.432,-0.715,23130.0
0.00404,4.0,31.25,0.0,0.510791,1.071533,0.726709,0.665479,-0.69,0.36,-0.606,0.701,-0.375,-0.718,23130.0
0.004989,4.0,31.25,0.0,0.50918,1.07395,0.726709,0.665479,-0.672,0.354,-0.636,0.668,-0.383,-0.75,23130.0
0.006005,4.0,31.25,0.0,0.509985,1.070728,0.727515,0.665479,-0.75,0.33,-0.648,0.672,-0.407,-0.783,23130.0
0.006981,4.0,31.25,0.0,0.509985,1.071533,0.725098,0.66709,-0.702,0.39,-0.648,0.672,-0.347,-0.722,23130.0
```

The values clearly don't match up, but that is expected.
It is standard to scale and possibly shift the raw values from an ADC to get physically meaningful output.

We can compare the source-of-truth CSV and raw decoded values to reverse-engineer scaling factors.
Dividing the raw decoded integer values by the source-of-truth values element-by-element gives:

```csv
nan,1000.000000,256.000000,nan,1241.211359,1241.212357,1241.212669,1241.211830,2666.666667,2666.666667,2666.666667,16000.000000,16000.000000,16000.000000,1.000000
1000000.000000,1000.000000,256.000000,nan,1241.212977,1241.211587,1241.212095,1241.212456,2666.666667,2666.666667,2666.666667,16000.000000,16000.000000,16000.000000,1.000000
1000000.000000,1000.000000,256.000000,nan,1241.212178,1241.211967,1241.212669,1241.212456,2666.666667,2666.666667,2666.666667,16000.000000,16000.000000,16000.000000,1.000000
1000000.000000,1000.000000,256.000000,nan,1241.211359,1241.211967,1241.212669,1241.211830,2666.666667,2666.666667,2666.666667,16000.000000,16000.000000,16000.000000,1.000000
1000000.000000,1000.000000,256.000000,nan,1241.212159,1241.212357,1241.212095,1241.211218,2666.666667,2666.666667,2666.666667,16000.000000,16000.000000,16000.000000,1.000000
1000000.000000,1000.000000,256.000000,nan,1241.211359,1241.212347,1241.212095,1241.211218,2666.666667,2666.666667,2666.666667,16000.000000,16000.000000,16000.000000,1.000000
1000000.000000,1000.000000,256.000000,nan,1241.212977,1241.211587,1241.211521,1241.211218,2666.666667,2666.666667,2666.666667,16000.000000,16000.000000,16000.000000,1.000000
1000000.000000,1000.000000,256.000000,nan,1241.212977,1241.212357,1241.211533,1241.211830,2666.666667,2666.666667,2666.666667,16000.000000,16000.000000,16000.000000,1.000000
```

Obvious values are:

- `TIMESTAMP`: 1000000 (converts raw microseconds value to seconds)
- `BATVOLT`: 1000 (converts raw millivolts to volts)
- `SYSTEMP`: 256
- `INAN0{1,2,3,4}`: anyone's guess; values are around 1241.212 (originally this might have been a rational number, but floating-point errors obscure exact value)
- `ACC1{X,Y,Z}`: 2666.666, which must have originally been 8000/3
- `ACC2{X,Y,Z}`: 16000

GYR and MAG scale factors would be similarly determined given a source-of-truth decoded CSV file with those channels enabled.

Investigation done!

Here's a simple C implementation:
