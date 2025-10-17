---
title: SPM Interface
---

<script setup>
import Image from '@/Components/Image.vue'

import formImg from './img/form.png'
import resultsImg from './img/results.png'
</script>

I made an interface for SPM analysis of TMG measurements.

It is visible at [TMG Toolkit](https://tmgtoolkit.com)!

The basic point is to answer: "is this post-conditioning TMG measurement appreciably larger and faster than this pre-conditioning measurement (indicating potentiation), and if so, where in the time domain and two what extent does the difference occur?"

Much more on potentiation and its analysis with SPM in [this article](./index)

Here is an image of the form:


<Image :src="formImg" caption="Form" />

<Image :src="resultsImg" caption="Results" />
