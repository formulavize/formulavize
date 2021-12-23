<template>
  <!--TextDumpView shows arbitrary text dumps for debugging-->
  <div id="textdump">
    <h3>{{title}}</h3>
    <pre>{{content}}</pre>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
export default defineComponent({
  name: 'TextDumpView',
  props: {
    title: String,
    content: String
  }
})
</script>

<style>
  #textdump {
    height: 100%;
    width: 100%;
    overflow-x: scroll;
    overflow-y: scroll;
  }
</style>