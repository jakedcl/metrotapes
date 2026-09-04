import {defineField, defineType} from 'sanity'

/** Legacy / still-present in dataset — keep editable so nothing is orphaned */
export const landingVideo = defineType({
  name: 'landingVideo',
  title: 'Landing Video',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string'}),
    defineField({
      name: 'video',
      title: 'Video',
      type: 'file',
      options: {accept: 'video/*'},
    }),
    defineField({
      name: 'fallbackImage',
      title: 'Fallback Image',
      type: 'image',
    }),
  ],
})
