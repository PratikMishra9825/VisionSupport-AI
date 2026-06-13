import { Client } from '@elastic/elasticsearch';
import mongoose from 'mongoose';

let esClient: Client | null = null;
let isEsAvailable = false;

export const initElasticsearch = async () => {
  const esUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
  try {
    esClient = new Client({ node: esUrl });
    // Check health
    await esClient.ping();
    isEsAvailable = true;
    console.log('Elasticsearch cluster connected successfully.');
    
    // Auto-create indices if they don't exist
    const indices = ['messages', 'recordings', 'transcripts', 'files', 'sessions', 'tickets', 'knowledgebases'];
    for (const index of indices) {
      const exists = await esClient.indices.exists({ index });
      if (!exists) {
        await esClient.indices.create({ index });
        console.log(`Created Elasticsearch index: ${index}`);
      }
    }
  } catch (error) {
    console.warn('Elasticsearch is unavailable. Search will fall back to MongoDB regex queries.');
    esClient = null;
    isEsAvailable = false;
  }
};

// Index document in Elasticsearch
export const indexDocument = async (index: string, id: string, doc: any) => {
  if (isEsAvailable && esClient) {
    try {
      await esClient.index({
        index,
        id,
        document: doc,
        refresh: true,
      });
    } catch (error) {
      console.error(`Elasticsearch indexing failed for index ${index}, id ${id}:`, error);
    }
  }
};

// Delete document from Elasticsearch
export const deleteDocument = async (index: string, id: string) => {
  if (isEsAvailable && esClient) {
    try {
      await esClient.delete({
        index,
        id,
        refresh: true,
      });
    } catch (error) {
      console.error(`Elasticsearch deletion failed for index ${index}, id ${id}:`, error);
    }
  }
};

// Search across indices
export const searchDocuments = async (index: string, queryText: string): Promise<any[]> => {
  if (isEsAvailable && esClient) {
    try {
      const response = await esClient.search({
        index,
        query: {
          multi_match: {
            query: queryText,
            fields: ['*'],
          },
        },
      });
      return response.hits.hits.map(hit => ({
        id: hit._id,
        ...(hit._source as object),
      }));
    } catch (error) {
      console.error(`Elasticsearch search query failed on index ${index}:`, error);
      // Fallback on error
    }
  }

  // Fallback: Search using MongoDB Mongoose models
  console.log(`Falling back to MongoDB text search for index: ${index}`);
  try {
    const db = mongoose.connection.db;
    if (!db) return [];

    let collectionName = '';
    let filter: any = {};

    switch (index) {
      case 'messages':
        collectionName = 'messages';
        filter = { text: { $regex: queryText, $options: 'i' } };
        break;
      case 'recordings':
        collectionName = 'recordings';
        filter = { $or: [{ recordingId: { $regex: queryText, $options: 'i' } }, { status: { $regex: queryText, $options: 'i' } }] };
        break;
      case 'transcripts':
        collectionName = 'aitranscripts';
        filter = { $or: [{ 'segments.text': { $regex: queryText, $options: 'i' } }, { summary: { $regex: queryText, $options: 'i' } }] };
        break;
      case 'files':
        collectionName = 'files';
        filter = { filename: { $regex: queryText, $options: 'i' } };
        break;
      case 'sessions':
        collectionName = 'sessions';
        filter = { sessionId: { $regex: queryText, $options: 'i' } };
        break;
      case 'tickets':
        collectionName = 'tickets';
        filter = { $or: [
          { ticketId: { $regex: queryText, $options: 'i' } },
          { issueTitle: { $regex: queryText, $options: 'i' } },
          { problemDescription: { $regex: queryText, $options: 'i' } },
          { customerName: { $regex: queryText, $options: 'i' } },
          { agentName: { $regex: queryText, $options: 'i' } }
        ] };
        break;
      case 'knowledgebases':
        collectionName = 'knowledgebases';
        filter = { $or: [
          { articleId: { $regex: queryText, $options: 'i' } },
          { title: { $regex: queryText, $options: 'i' } },
          { problemDescription: { $regex: queryText, $options: 'i' } },
          { solution: { $regex: queryText, $options: 'i' } }
        ] };
        break;
      default:
        return [];
    }

    const cursor = db.collection(collectionName).find(filter);
    const results = await cursor.toArray();
    return results.map(doc => ({
      id: doc._id.toString(),
      ...doc,
    }));
  } catch (mongoError) {
    console.error('MongoDB search fallback failed:', mongoError);
    return [];
  }
};

// Initialize connection async on start
initElasticsearch();
