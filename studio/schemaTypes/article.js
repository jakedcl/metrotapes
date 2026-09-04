import {defineField, defineType} from 'sanity'

/** Legacy / still-present in dataset — keep editable so nothing is orphaned */
export const article = defineType({
  name: 'article',
  title: 'Article',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string'}),
    defineField({name: 'description', title: 'Description', type: 'text'}),
    defineField({
      name: 'media',
      title: 'Media',
      type: 'array',
      of: [{type: 'mediaItem'}],
    }),
  ],
})
