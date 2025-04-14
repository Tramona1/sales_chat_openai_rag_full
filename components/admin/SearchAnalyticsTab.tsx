import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getSupabaseClient } from '../../utils/supabaseClient';

// Colors for the charts
const COLORS = [
  '#3f51b5', '#f44336', '#4caf50', '#ff9800', '#2196f3',
  '#9c27b0', '#00bcd4', '#ffeb3b', '#795548', '#607d8b'
];

interface SearchTrace {
  id: string;
  query: string;
  timestamp: string;
  query_analysis: {
    primaryCategory: string;
    secondaryCategories: string[];
    technicalLevel: number;
    intent: string;
    entities: any[];
  };
  search_decisions: {
    initialFilter: any;
    appliedFilter: any;
    filterRelaxed: boolean;
    relaxationReason?: string;
    categoryBalancing?: {
      before: { sales: number; nonSales: number };
      after: { sales: number; nonSales: number };
    };
  };
  result_stats: {
    initialResultCount: number;
    finalResultCount: number;
    categoriesInResults: Record<string, number>;
    salesContentRatio: number;
  };
  timings: {
    analysis: number;
    search: number;
    reranking?: number;
    total: number;
  };
}

interface CategoryDistribution {
  category: string;
  count: number;
  percentage: number;
}

const SearchAnalyticsTab: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [traces, setTraces] = useState<SearchTrace[]>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<CategoryDistribution[]>([]);
  const [timeRange, setTimeRange] = useState<number>(7); // Default to 7 days
  const [selectedTrace, setSelectedTrace] = useState<SearchTrace | null>(null);

  // Fetch data function
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const supabase = getSupabaseClient();
      
      // Get recent search traces
      const { data: tracesData, error: tracesError } = await supabase
        .from('search_traces')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);
        
      if (tracesError) {
        throw new Error(`Error fetching traces: ${tracesError.message}`);
      }
      
      // Get category distribution using the SQL function
      const { data: distributionData, error: distributionError } = await supabase
        .rpc('get_recent_category_distribution', { days_back: timeRange });
        
      if (distributionError) {
        throw new Error(`Error fetching category distribution: ${distributionError.message}`);
      }
      
      setTraces(tracesData || []);
      setCategoryDistribution(distributionData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Error fetching search analytics:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Effect to fetch data on component mount and when timeRange changes
  useEffect(() => {
    fetchData();
  }, [timeRange]);
  
  // Handle time range change
  const handleTimeRangeChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setTimeRange(event.target.value as number);
  };
  
  // Select a trace for detailed view
  const handleSelectTrace = (trace: SearchTrace) => {
    setSelectedTrace(trace);
  };
  
  // Prepare data for the category distribution chart
  const categoryChartData = categoryDistribution.map(item => ({
    name: item.category,
    value: item.count,
    percentage: item.percentage
  }));
  
  // Calculate sales vs non-sales content ratio
  const salesRatioData = traces.length > 0
    ? [
        { name: 'Sales Content', value: traces.reduce((sum, trace) => sum + trace.result_stats.salesContentRatio, 0) / traces.length * 100 },
        { name: 'Other Content', value: 100 - (traces.reduce((sum, trace) => sum + trace.result_stats.salesContentRatio, 0) / traces.length * 100) }
      ]
    : [];
  
  // Prepare data for the intent distribution chart
  const intentCounts: Record<string, number> = {};
  traces.forEach(trace => {
    const intent = trace.query_analysis.intent;
    intentCounts[intent] = (intentCounts[intent] || 0) + 1;
  });
  
  const intentChartData = Object.entries(intentCounts).map(([name, value]) => ({
    name,
    value
  }));
  
  // Format timestamp
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  return (
    <Container maxWidth="lg">
      <Box my={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          Search Analytics & Category Distribution
        </Typography>
        
        <Box mb={4} display="flex" alignItems="center">
          <FormControl variant="outlined" style={{ minWidth: 200, marginRight: 16 }}>
            <InputLabel id="time-range-label">Time Range</InputLabel>
            <Select
              labelId="time-range-label"
              value={timeRange}
              onChange={handleTimeRangeChange}
              label="Time Range"
            >
              <MenuItem value={1}>Last 24 Hours</MenuItem>
              <MenuItem value={7}>Last 7 Days</MenuItem>
              <MenuItem value={30}>Last 30 Days</MenuItem>
              <MenuItem value={90}>Last 90 Days</MenuItem>
            </Select>
          </FormControl>
          
          <Button 
            variant="contained" 
            color="primary" 
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Refresh Data'}
          </Button>
        </Box>
        
        {error && (
          <Paper elevation={2} style={{ padding: 16, marginBottom: 24, backgroundColor: '#ffebee' }}>
            <Typography color="error">Error: {error}</Typography>
          </Paper>
        )}
        
        {!loading && !error && (
          <>
            <Grid container spacing={4}>
              {/* Category Distribution Chart */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Category Distribution
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={categoryChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {categoryChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value, name, props) => [`${value} queries (${props.payload.percentage.toFixed(1)}%)`, name]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Sales vs Non-Sales Content Ratio */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Sales vs. Non-Sales Content Ratio
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={salesRatioData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          <Cell fill="#3f51b5" />
                          <Cell fill="#4caf50" />
                        </Pie>
                        <Tooltip formatter={(value) => [`${value.toFixed(1)}%`]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Intent Distribution */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Query Intent Distribution
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={intentChartData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="value" name="Count" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
            
            {/* Recent Searches Table */}
            <Box mt={4}>
              <Typography variant="h6" gutterBottom>
                Recent Searches
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Query</TableCell>
                      <TableCell>Time</TableCell>
                      <TableCell>Primary Category</TableCell>
                      <TableCell>Sales Ratio</TableCell>
                      <TableCell>Filter Relaxed</TableCell>
                      <TableCell>Results</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {traces.map((trace) => (
                      <TableRow key={trace.id}>
                        <TableCell>{trace.query}</TableCell>
                        <TableCell>{formatDate(trace.timestamp)}</TableCell>
                        <TableCell>
                          <Chip 
                            label={trace.query_analysis.primaryCategory} 
                            color={trace.query_analysis.primaryCategory.includes('CASE_STUDIES') || 
                                  trace.query_analysis.primaryCategory.includes('SALES') ? 
                                  'primary' : 'default'} 
                            size="small" 
                          />
                        </TableCell>
                        <TableCell>{(trace.result_stats.salesContentRatio * 100).toFixed(1)}%</TableCell>
                        <TableCell>{trace.search_decisions.filterRelaxed ? 'Yes' : 'No'}</TableCell>
                        <TableCell>{trace.result_stats.finalResultCount}</TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleSelectTrace(trace)}
                          >
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
            
            {/* Search Trace Details */}
            {selectedTrace && (
              <Box mt={4}>
                <Paper elevation={3} style={{ padding: 24 }}>
                  <Typography variant="h6" gutterBottom>
                    Search Trace Details: "{selectedTrace.query}"
                  </Typography>
                  
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>Query Analysis</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="subtitle2">Primary Category:</Typography>
                          <Typography variant="body2">{selectedTrace.query_analysis.primaryCategory}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="subtitle2">Secondary Categories:</Typography>
                          <Box display="flex" flexWrap="wrap" gap={0.5}>
                            {selectedTrace.query_analysis.secondaryCategories.map((category, i) => (
                              <Chip key={i} label={category} size="small" />
                            ))}
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="subtitle2">Intent:</Typography>
                          <Typography variant="body2">{selectedTrace.query_analysis.intent}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="subtitle2">Technical Level:</Typography>
                          <Typography variant="body2">{selectedTrace.query_analysis.technicalLevel}/5</Typography>
                        </Grid>
                        <Grid item xs={12}>
                          <Typography variant="subtitle2">Entities:</Typography>
                          <Box display="flex" flexWrap="wrap" gap={0.5}>
                            {selectedTrace.query_analysis.entities.map((entity, i) => (
                              <Chip 
                                key={i} 
                                label={`${entity.name} (${entity.type})`} 
                                size="small"
                                variant="outlined" 
                              />
                            ))}
                          </Box>
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                  
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>Search Decisions</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Typography variant="subtitle2">Initial Filter:</Typography>
                          <pre style={{ overflowX: 'auto', backgroundColor: '#f5f5f5', padding: 8 }}>
                            {JSON.stringify(selectedTrace.search_decisions.initialFilter, null, 2)}
                          </pre>
                        </Grid>
                        <Grid item xs={12}>
                          <Typography variant="subtitle2">Applied Filter:</Typography>
                          <pre style={{ overflowX: 'auto', backgroundColor: '#f5f5f5', padding: 8 }}>
                            {JSON.stringify(selectedTrace.search_decisions.appliedFilter, null, 2)}
                          </pre>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="subtitle2">Filter Relaxed:</Typography>
                          <Typography variant="body2">
                            {selectedTrace.search_decisions.filterRelaxed ? 'Yes' : 'No'}
                          </Typography>
                        </Grid>
                        {selectedTrace.search_decisions.relaxationReason && (
                          <Grid item xs={6}>
                            <Typography variant="subtitle2">Relaxation Reason:</Typography>
                            <Typography variant="body2">
                              {selectedTrace.search_decisions.relaxationReason}
                            </Typography>
                          </Grid>
                        )}
                        {selectedTrace.search_decisions.categoryBalancing && (
                          <Grid item xs={12}>
                            <Typography variant="subtitle2">Category Balancing:</Typography>
                            <Box>
                              <Typography variant="body2">
                                Before: Sales {selectedTrace.search_decisions.categoryBalancing.before.sales}, 
                                Non-Sales {selectedTrace.search_decisions.categoryBalancing.before.nonSales}
                              </Typography>
                              <Typography variant="body2">
                                After: Sales {selectedTrace.search_decisions.categoryBalancing.after.sales}, 
                                Non-Sales {selectedTrace.search_decisions.categoryBalancing.after.nonSales}
                              </Typography>
                            </Box>
                          </Grid>
                        )}
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                  
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>Result Statistics</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="subtitle2">Initial Result Count:</Typography>
                          <Typography variant="body2">{selectedTrace.result_stats.initialResultCount}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="subtitle2">Final Result Count:</Typography>
                          <Typography variant="body2">{selectedTrace.result_stats.finalResultCount}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="subtitle2">Sales Content Ratio:</Typography>
                          <Typography variant="body2">
                            {(selectedTrace.result_stats.salesContentRatio * 100).toFixed(1)}%
                          </Typography>
                        </Grid>
                        <Grid item xs={12}>
                          <Typography variant="subtitle2">Categories in Results:</Typography>
                          <Box display="flex" flexWrap="wrap" gap={0.5} mt={1}>
                            {Object.entries(selectedTrace.result_stats.categoriesInResults).map(([category, count], i) => (
                              <Chip 
                                key={i} 
                                label={`${category}: ${count}`} 
                                size="small"
                                color={category.includes('CASE_STUDIES') || category.includes('SALES') ? 'primary' : 'default'}
                              />
                            ))}
                          </Box>
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                  
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>Timing Information</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="subtitle2">Analysis Time:</Typography>
                          <Typography variant="body2">{selectedTrace.timings.analysis}ms</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="subtitle2">Search Time:</Typography>
                          <Typography variant="body2">{selectedTrace.timings.search}ms</Typography>
                        </Grid>
                        {selectedTrace.timings.reranking && (
                          <Grid item xs={6}>
                            <Typography variant="subtitle2">Reranking Time:</Typography>
                            <Typography variant="body2">{selectedTrace.timings.reranking}ms</Typography>
                          </Grid>
                        )}
                        <Grid item xs={6}>
                          <Typography variant="subtitle2">Total Time:</Typography>
                          <Typography variant="body2">{selectedTrace.timings.total}ms</Typography>
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Paper>
              </Box>
            )}
          </>
        )}
        
        {loading && (
          <Box display="flex" justifyContent="center" my={4}>
            <CircularProgress />
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default SearchAnalyticsTab; 