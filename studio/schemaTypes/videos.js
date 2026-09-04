import {defineField, defineType} from 'sanity'

export const videos = defineType({
  name: 'videos',
  title: 'Videos',
  type: 'document',
  fields: [
    defineField({
      name: 'playlistId',
      title: 'YouTube Playlist ID',
      type: 'string',
      description:
        'The ID of your YouTube playlist (e.g. for https://www.youtube.com/playlist?list=PLxxx, enter PLxxx)',
    }),
  ],
})
