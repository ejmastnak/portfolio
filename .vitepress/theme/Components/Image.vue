<script setup>
const props = defineProps({
  src: String,
  caption: String,
})
</script>

<template>
  <div class="flex flex-col">
    <img 
      :src="src"
      class="mx-auto my-auto object-cover rounded-md"
    />
    <p v-if="caption" class="-translate-y-2 text-gray-600 text-center">{{caption}}</p>
  </div>
</template>
