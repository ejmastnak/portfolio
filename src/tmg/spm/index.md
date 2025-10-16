---
title: SPM
---

# SPM and potentiation

Goal: use statistical parametric mapping, a time series analysis technique from neuroscience, to analyze TMG measurements for potentiation.

[Link to prepress article](#) TODO

## What is potentiation

A phenomenon in which a short, intense burst of muscle activity (called a conditioning exercise in this context) temporarily increases the amplitude, force, and speed of both voluntary and electrically induced muscle contractions that immediately follow.

See Introduction of `/home/ej/Documents/projects/tmg-bmc/projects/frontiers/archive/frontiers-2022-1mps/manuscript/frontiers.pdf`

## Motivation for understanding potentiation

In general, prior muscle activity produces two different—and potentially coexistent—muscle responses: fatigue and potentiation.
Limited by the inevitable onset of fatigue, one cannot use conditioning exercises to increase subsequent muscle performance via potentiation ad infinitum—eventually fatigue outweighs any potentiation-like performance improvement.
Fatigue can coexist with PAP (Rassier and MacIntosh, 2000), and measured muscular performance represents the net balance between processes that cause fatigue and processes that cause potentiation (Rassier and MacIntosh, 2000).
Striking a favorable balance between fatigue and potentiation should be of interest to coaches, sports scientists, and athletes alike.
Doing so requires a reliable means of detecting and quantifying potentiation, and statistical parametric mapping (SPM) offers a novel way of doing so—directly in the time domain in which the muscle response is originally measured.

::: details PAP vs PAPE
We pause briefly to comment on some ambiguity in the literature surrounding post-conditioning
enhancements in muscular performance, generally involving confusion between the following two
phenomena (Prieske et al., 2020).

- **Post-activation potentiation (PAP)** is a short-term enhancement in a muscle’s contractile properties during an electrically-induced muscle twitch, which generally manifests as enhanced twitch force, enhanced twitch amplitude, and decreased time to peak contraction. PAP has a short half-life (∼30 s; Vandervoort et al. (1983)) and is verified at the specific level of an individual muscle using a non-voluntary, electrically-induced muscle twitch. PAP generally requires nontrivial equipment and a standardized test environment to measure.

- **Post-activation performance enhancement (PAPE)** is a longer-term performance improvement in exercises that measure maximal strength, power, and speed (e.g. a maximum vertical jump or a 60-meter sprint). PAPE has a longer half-life (maximum performance enhancement occurs on the order of 5 to 10 minutes following the initial conditioning exercise; Wilson et al. (2013)) and is verified at a macroscopic level by observing exercise performance (rather than measuring the contractile properties of a specific muscle).
PAPE is thus simpler to measure than than PAP, but often at the expense of a less controlled and systematic experiment.
:::

The present study concerns PAP, i.e. the short-term, post-conditioning enhancement in muscular contractile properties during electrically-induced twitch, and for this reason we will tend to use the more specific term twitch potentiation. Borrowing the definition of Hodgson et al. (2005), “a twitch is a brief muscle contraction in response to a single presynaptic action potential or a single, synchronised volley of action potentials.” 

## What is SPM

The basic point is to answer: "is this post-conditioning TMG measurement appreciably larger and faster than this pre-conditioning measurement (indicating potentiation), and if so, where in the time domain and two what extent does the difference occur?"

See 2.3.4 of `/home/ej/Documents/projects/tmg-bmc/projects/frontiers/archive/frontiers-2022-1mps/manuscript/frontiers.pdf`


Broadly speaking, classical statistical tests on zero-dimensional datasets quantify the probability that randomly-distributed scalar data would produce a test statistic exceeding a critical threshold value.
SPM- based statistical testing is a conceptually analogous generalization to datasets consisting of continuous, and in our case one-dimensional,1 signals.
SPM testing quantifies the probability that smooth, 1D random fields would produce a test statistic continuum whose maximum exceeds a threshold test statistic value (Pataky, 2011; Pataky et al., 2016, 2015).

The study used one-dimensional paired SPM t-tests to evaluate the effect of the ISQ conditioning exercise on the rectus femoris’s twitch contraction properties in the time domain.
Pre-conditioning TMG signals were compared against post-conditioning TMG signals and statistically significant differences between the two were interpreted as indicating a potentiated post-conditioning muscle response.
Only the first 100 ms of the 1000 ms TMG twitch contraction response was used as the region of interest for SPM analysis, since these first 100 ms entirely capture the muscle’s contraction phase.

SPM testing of TMG signals follows a procedure analogous to the classical Student’s t-tests applied to the scalar twitch contraction parameters in Section 2.3.3, only with the scalar parameters and associated scalar t-statistic generalized to one-dimensional TMG signals.
We first assume the null hypothesis that differences in a collection of pre- and post-conditioning TMG signals are due to chance alone.
More formally, letting µpre(t) and µpost(t) denote the mean pre- and post-conditioning TMG amplitudes at time t, respectively, the null hypothesis is

µpre(t) −µpost(t) = 0 for all t.

We then apply the `stats.ttest` paired function provided by the SPM1d library to the set of pre- and post-conditioning TMG signals to construct a one-dimensional statistical parametric map (Pataky, 2011).
This map, also called the SPM t-continuum, serves to quantify the difference in the pre- and post-conditioning TMG signals at each point in time.
(Much like the classical, scalar t-statistic associated with scalar twitch contraction parameters quantifies the difference between the pre- and post-conditioning parameter values.)
Example SPM t-continua appear in Figure 5 in the Results section.

Finally, we perform a two-tailed SPM inference on the SPM t-continuum at the significance level α = 0.01
using the inference function provided by the SPM1d library’s SPM T class.
The final inference step produces a threshold t-statistic value t∗, which may be interpreted as the threshold at which the maximum value of an SPM t-continuum generated by smooth, Gaussian random continua (as opposed to, say, TMG signals) would exceed t∗with probability α (Pataky, 2011). From the perspective of classical hypothesis testing, we reject the null hypothesis in Equation 1 at the significance level α if the SPM t-continuum generated from the pre- and post-conditioning TMG signals exceeds t∗. The final inference step also produces a probability value p associated with each supra-threshold region of the SPM t-continuum. This p value represents the probability that smooth, Gaussian random continua would produce a supra-threshold region as wide or wider (relative to the width of the entire SPM t-continuum) than the supra-threshold region observed in the SPM t-continuum computed from the measured TMG signals (Pataky, 2011).

To complement the SPM t-continuum generated from each SPM paired t-test, we also collected the following discrete metrics to make SPM test results easier to compare at a glance:

- The times T1 and T2 at which a supra-threshold region begins and ends, respectively.
- The maximum value t-max of maximum value of the SPM t-continuum.
- The area of the supra-threshold cluster in the (time, SPM-t) plane.

The area of the supra-threshold cluster was computed using the trapezoid method for numerical integration, while the other metrics are provided directly by the SPM1d library.

## Motivation for SPM

See 1.2 of `/home/ej/Documents/projects/tmg-bmc/projects/frontiers/archive/frontiers-2022-1mps/manuscript/frontiers.pdf`

Currently, it is standard to quantify the level of twitch potentiation using discrete twitch contraction parameters computed retrospectively from measurements of muscle displacement, force production, or electrical activity with respect to time.
Examples of these parameters include maximal amplitude of muscle contraction, time taken to reach peak contraction, maximal twitch rate of force development (Cochrane et al., 2010; Kuu et al., 2007; Wallace et al., 2019), and peak M-wave amplitude (Rodriguez-Falces et al., 2013).
In each case, computing these parameters reduces the originally-measured muscle response, which is generally a one-dimensional time series (e.g. muscle displacement with respect to time), to a single number, i.e. a zero-dimensional scalar value.
One can then compare pre-conditioning and post-conditioning parameter values to retrospectively infer the presence (or lack) of post-activation potentiation.
A promising new approach to quantifying TP would analyze muscle response and detect and quantify potentiation directly in the time domain in which the muscle response was originally measured, without the dimensionality reduction imposed by computing discrete twitch contraction parameters. One way of performing such an analysis is the method of statistical parametric mapping (SPM) (Friston et al., 1995; Pataky, 2011; Pataky et al., 2016, 2015).

Borrowing the definition of Flandin and Friston (2008), “Statistical parametric mapping is the application of random field theory to make inferences about the topological features of statistical processes that are continuous functions of space or time”. SPM has so far found its greatest application in neuroimaging for detecting regionally-specific brain activations (Friston et al., 1995). We use SPM similarly in the present study—applied to one-dimensional functions of time (i.e. twitch amplitude with respect to time) instead of three-dimensional functions of space (i.e. brain scans)—to detect regionally-specific differences between pre-conditioning and post-conditioning muscle responses directly in the time domain. Statistically significant differences between pre-conditioning and post-conditioning muscle responses are then interpreted as post-activation potentiation. More so, because SPM preserves the time-domain information contained in the original muscle response, SPM gives an indication of when the potentiation- like state occurred over the course of the muscle twitch. Of course using SPM and conventional twitch contraction parameters are not mutually exclusive, and in this study we use both methods together as a means of detection potentiation.

## Algorithm

Input data: a set of TMG measurements pre-conditioning and a set of TMG measurements post-conditioning.
Taken close to each other relative to the ~30 second half-life of PAP (e.g. every 3-5 seconds).
About 5 signals per set for meaningful statistical analysis.

- Separate measurements into two groups
- Pass groups to paired `stats.ttest` function provided by the SPM1d library.
- Receive as output SPM-t statistic curve and threshold significance level.

Regions where the SPM t-statistic curve exceeds the threshold significance level indicates a statisticaly meaningful difference between the pre- and post-conditioning signals, suggesting potentiation.
