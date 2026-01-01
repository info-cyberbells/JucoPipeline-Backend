## API Usage Examples

### **Example 1: STATISTICS Tab - Pitching Stats (Default)**
```
GET /api/coach/statistics?tab=statistics&statsType=pitching&sortBy=era&sortOrder=asc&page=1&limit=20
```

### **Example 2: STATISTICS Tab - With Position Filter**
```
GET /api/coach/statistics?tab=statistics&statsType=pitching&position=RHP&sortBy=era&sortOrder=asc&era_min=2.00&era_max=3.00
```

### **Example 3: STATISTICS Tab - Batting Stats with Filters**
```
GET /api/coach/statistics?tab=statistics&statsType=batting&sortBy=batting_average&sortOrder=desc&batting_average_min=0.300&home_runs_min=10
```

### **Example 4: DATE RANGE Tab - Specific Date**
```
GET /api/coach/statistics?tab=date_range&date=2025-04-26&statsType=pitching&sortBy=era&sortOrder=asc
```

### **Example 5: DATE RANGE Tab - Date Range**
```
GET /api/coach/statistics?tab=date_range&start_date=2025-04-01&end_date=2025-04-30&statsType=pitching
```

### **Example 6: Search Player**
```
GET /api/coach/statistics?search=Jack Miller&statsType=pitching
```

### **Example 7: Complete Filter Query**
```
GET /api/coach/statistics?tab=statistics&statsType=pitching&position=RHP&sortBy=era&sortOrder=asc&era_min=2.00&era_max=3.50&wins_min=5&innings_pitched_min=30&page=1&limit=20