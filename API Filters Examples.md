## API Filters Examples

### **Example 1: No Filters (Default)**
```
GET /api/coach/dashboard?page=1&limit=20&statsType=batting&sortBy=batting_average&sortOrder=desc
```

### **Example 2: Batting Average Filter**
```
Batting Average Filter : /api/coach/dashboard?page=1&limit=20&statsType=batting&sortBy=batting_average&sortOrder=desc&batting_average_min=0.300&batting_average_max=0.500
```

### **Example 3: Multiple Batting Filters**
```
GET /api/coach/dashboard?page=1&limit=20&statsType=batting&sortBy=batting_average&sortOrder=desc&batting_average_min=0.300&batting_average_max=0.500&home_runs_min=5&home_runs_max=20&rbi_min=30
```

### **Example 4: Pitching Filters**
```
Pitching Filters : /api/coach/dashboard?page=1&limit=20&statsType=pitching&sortBy=era&sortOrder=asc&era_min=0.00&era_max=3.50&wins_min=5
```

### **Example 5: Fielding Filters**
```
Fielding Filters : /api/coach/dashboard?page=1&limit=20&statsType=fielding&sortBy=fielding_percentage&sortOrder=desc&fielding_percentage_min=0.900&fielding_percentage_max=1.000&errors_max=10
```