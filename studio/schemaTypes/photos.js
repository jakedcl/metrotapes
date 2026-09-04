import {defineField, defineType} from 'sanity'

export const photos = defineType({
  name: 'photos',
  title: 'Photos',
  type: 'document',
  fields: [
    defineField({
      name: 'images',
      title: 'Images',
      type: 'array',
      of: [{type: 'image'}],
      description: 'Upload all photos here. They will appear in the order they are arranged here.',
    }),
  ],
})
