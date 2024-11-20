
const Order = require('../../models/orderSchema')
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit-table');

const salesReportController = {
  getSalesReport: async (req, res) => {
    try {
      const { startDate, endDate, reportType } = req.query;
      let query = {
        status:{
          $nin:['Cancelled','Return Request','Returned','Pending','Failed']
        }
      };

      if (startDate && endDate) {
        query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
      } else if (reportType) {
        const currentDate = new Date();
        switch (reportType) {
          case 'daily':
            query.createdAt = { $gte: new Date(currentDate.setHours(0, 0, 0, 0)), $lte: new Date(currentDate.setHours(23, 59, 59, 999)) };
            break;
          case 'weekly':
            const weekStart = new Date(currentDate.setDate(currentDate.getDate() - currentDate.getDay()));
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            query.createdAt = { $gte: weekStart, $lte: weekEnd };
            break;
          case 'monthly':
            const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
            query.createdAt = { $gte: monthStart, $lte: monthEnd };
            break;
          case 'yearly':
            const yearStart = new Date(currentDate.getFullYear(), 0, 1);
            const yearEnd = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59, 999);
            query.createdAt = { $gte: yearStart, $lte: yearEnd };
            break;
        }
      }

      const orders = await Order.find(query).populate('appliedCouponId');


      const salesReport = {
        totalSales: orders.length,
        totalAmount: orders.reduce((sum, order) => sum + order.finalAmount, 0),
        totalDiscount: orders.reduce((sum, order) => sum + (order.finalAmount - order.totalPrice), 0),
        orders: orders.map(order => ({
          orderId: order.orderId,
          date: order.createdAt,
          amount: order.totalPrice,
          finalAmount: order.finalAmount,
          discount: order.finalAmount - order.totalPrice,
          appliedCouponId: order.appliedCouponId ? order.appliedCouponId._id : null,
          couponCode: order.appliedCouponId ? order.appliedCouponId.code : 'N/A'
        }))
      };
      //console.log('sales report  details:',salesReport)

      res.render('admin/salesReport', { salesReport });
    } catch (error) {
      console.error('Error generating sales report:', error);
      res.status(500).send('Error generating sales report');
    }
  },

  downloadReport: async (req, res) => {
    try {
      // Log received parameters
      console.log('Request query parameters:', req.query);
      const { format, startDate, endDate, reportType } = req.query;
      let query = {
        status:{
          $nin:['Cancelled','Return Request','Returned','Pending','Failed']
        }
      };

      console.log('Parsed parameters:', {
        format,
        startDate,
        endDate,
        reportType
      });

      // Build the date query
      if (startDate && endDate) {
        query.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      } else if (reportType) {
        const currentDate = new Date();

        switch (reportType) {
          case 'daily':
            query.createdAt = {
              $gte: new Date(currentDate.setHours(0, 0, 0, 0)),
              $lte: new Date(currentDate.setHours(23, 59, 59, 999))
            };
            break;
          case 'weekly':
            const weekStart = new Date(currentDate);
            weekStart.setDate(currentDate.getDate() - currentDate.getDay());
            weekStart.setHours(0, 0, 0, 0);

            const weekEnd = new Date(weekStart);
            
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            query.createdAt = {
              $gte: weekStart,
              $lte: weekEnd
            };
            break;
          case 'monthly':
            const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

            query.createdAt = {
              $gte: monthStart,
              $lte: monthEnd
            };
            break;
          case 'yearly':
            const yearStart = new Date(currentDate.getFullYear(), 0, 1);
            const yearEnd = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59, 999);

            query.createdAt = {
              $gte: yearStart,
              $lte: yearEnd
            };
            break;
        }
      }
      console.log('MongoDB query:', query);

      const orders = await Order.find(query).populate('appliedCouponId');
      console.log(`Found ${orders.length} orders`);

      if (format === 'excel') {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        // Add report period information
        worksheet.addRow(['Sales Report']);
        worksheet.addRow(['Period: ' + (reportType || `${startDate} to ${endDate}`)]);
        worksheet.addRow([]);  // Empty row for spacing

        worksheet.columns = [
          { header: 'Order ID', key: 'orderId', width: 40 },
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Amount', key: 'amount', width: 10 },
          { header: 'Discount', key: 'discount', width: 10 },
          { header: 'Coupon Code', key: 'couponCode', width: 15 }
        ];

        orders.forEach(order => {
          worksheet.addRow({
            orderId: order._id.toString(),
            date: order.createdAt.toDateString(),
            amount: order.totalPrice,
            discount: order.finalAmount - order.totalPrice,
            finalAmount: order.finalAmount,
            appliedCouponId: order.appliedCouponId ? order.appliedCouponId._id : null,
            couponCode: order.appliedCouponId ? order.appliedCouponId.code : 'N/A'
          });
        });

        // Add summary at the bottom
        worksheet.addRow([]);
        worksheet.addRow(['Total Orders:', orders.length]);
        worksheet.addRow(['Total Amount:', orders.reduce((sum, order) => sum + order.finalAmount, 0).toFixed(2)]);
        worksheet.addRow(['Total Discount:', orders.reduce((sum, order) => sum + (order.finalAmount - order.totalPrice), 0).toFixed(2)]);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=sales_report.xlsx');

        await workbook.xlsx.write(res);
        res.end();
      } else if (format === 'pdf') {
        const doc = new PDFDocument({
          size: 'A4',
          layout: 'landscape',
          margin: 30,
          size: 'A4',
          bufferPages: true
        });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=sales_report.pdf');

        doc.pipe(res);
        doc.fontSize(16).text('Sales Report', { align: 'center' });
        doc.fontSize(12).text(`Period: ${reportType || `${startDate} to ${endDate}`}`, { align: 'center' });
        doc.moveDown();

        // Define the table
        const table = {
          headers: ['Order ID', 'Date', 'Amount', 'Discount', 'Final Amount', 'Coupon'],
          rows: orders.map(order => [
            order._id.toString(),
            order.createdAt.toDateString(),
            order.totalPrice.toFixed(2),
            (order.finalAmount - order.totalPrice).toFixed(2),
            order.finalAmount.toFixed(2),
            order.appliedCouponId ? order.appliedCouponId.code : 'N/A'
          ])
        };
        // Draw the table
        await doc.table(table, {
          prepareHeader: () => doc.fontSize(10),
          prepareRow: () => doc.fontSize(10)
        });

        // Add summary
        doc.moveDown();
        doc.fontSize(12);
        doc.text(`Total Orders: ${orders.length}`);
        doc.text(`Total Amount: $${orders.reduce((sum, order) => sum + order.finalAmount, 0).toFixed(2)}`);
        doc.text(`Total Discount: $${orders.reduce((sum, order) => sum + (order.finalAmount - order.totalPrice), 0).toFixed(2)}`);

        doc.end();
      } else {
        res.status(400).send('Invalid format specified');
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      res.status(500).send('Error downloading report');
    }
  }
};

module.exports = salesReportController;